#!/usr/bin/env python3
"""Source-integrity regression: retry only transient failures, prioritize Platts.

This test uses mocks; no external HTTP, DB, OIDC, Telegram or market mutation.
"""
from __future__ import annotations
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import telegram_public_pdf_ingest_v2 as ingest
import telegram_public_market_ingest_resilient as resilient


class Response:
    def __init__(self, status: int, code: str | None = None):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._data = {'ok': True} if self.ok and code is None else {'ok': False, 'code': code}

    def json(self):
        return self._data


class IngestBackoffTests(unittest.TestCase):
    def test_db_connection_saturation_recovers_without_extra_oidc_refresh(self):
        with patch.object(ingest, '_fresh_oidc', return_value='test-token') as tok, \
             patch.object(ingest.requests, 'post', side_effect=[
                 Response(500, 'WORKER_ERROR'), Response(503, 'PGRST002'), Response(200)
             ]) as post, \
             patch.object(ingest.time, 'sleep') as pause:
            result = ingest.post_json_refreshing('https://example.test', '', 'prepare', {'message_id': 7510})
            self.assertTrue(result['ok'])
            self.assertEqual(post.call_count, 3)
            self.assertEqual([args[0][0] for args in pause.call_args_list], [1, 2])
            self.assertEqual([args[1]['force'] for args in tok.call_args_list], [False, False, False])

    def test_oidc_denial_refreshes_only_once_then_succeeds(self):
        with patch.object(ingest, '_fresh_oidc', side_effect=['expired', 'renewed']) as tok, \
             patch.object(ingest.requests, 'post', side_effect=[
                 Response(401, 'GITHUB_OIDC_DENIED'), Response(200)
             ]) as post, patch.object(ingest.time, 'sleep') as pause:
            self.assertTrue(ingest.post_json_refreshing('https://example.test','','finalize',{})['ok'])
            self.assertEqual([args[1]['force'] for args in tok.call_args_list], [False, True])
            self.assertEqual(post.call_count, 2)
            pause.assert_not_called()

    def test_invalid_source_denial_is_not_retried(self):
        with patch.object(ingest, '_fresh_oidc', return_value='t'), \
             patch.object(ingest.requests, 'post', return_value=Response(403,'CHANNEL_NOT_ALLOWED')) as post, \
             patch.object(ingest.time, 'sleep') as pause:
            with self.assertRaisesRegex(RuntimeError, 'CHANNEL_NOT_ALLOWED'):
                ingest.post_json_refreshing('https://example.test','','prepare',{})
            self.assertEqual(post.call_count, 2)  # one OIDC refresh, no additional retries
            pause.assert_not_called()

    def test_persistent_db_failure_is_bounded(self):
        with patch.object(ingest, '_fresh_oidc', return_value='t'), \
             patch.object(ingest.requests, 'post', return_value=Response(500, 'remaining connection slots are reserved')) as post, \
             patch.object(ingest.time, 'sleep') as pause:
            with self.assertRaisesRegex(RuntimeError, 'connection slots'):
                ingest.post_json_refreshing('https://example.test','','run-status',{})
            self.assertEqual(post.call_count, 5)
            self.assertEqual([args[0][0] for args in pause.call_args_list], [1, 2, 4, 8])

    def test_primary_source_is_first_and_secondary_work_is_capped(self):
        calls = []
        def discover(_session, channel, limit):
            calls.append((channel, limit))
            return [{'message_id': 7510}]

        def success(_session, _root, _url, _oidc, _channel, _msg, counters):
            counters.accepted_files += 1

        with patch.dict(os.environ, {
            'RONA_TELEGRAM_INGEST_URL': 'https://example.test',
            'RONA_INGEST_OIDC_TOKEN': 'dummy-token',
            'RONA_TELEGRAM_RUN_KEY': 'gh-validated-1',
            'TELEGRAM_CHANNELS': 'Samantahlil,platts_digits',
            'TELEGRAM_MAX_MESSAGES': '80'
        }), patch.object(resilient.base, 'post_json', return_value={'ok':True}), \
             patch.object(resilient, 'collect_public_messages', side_effect=discover), \
             patch.object(resilient, 'process_message', side_effect=success):
            status = resilient.collect()
        self.assertEqual(status, 0)
        self.assertEqual(calls, [('platts_digits',24),('Samantahlil',6)])


if __name__ == '__main__':
    unittest.main(verbosity=2)
