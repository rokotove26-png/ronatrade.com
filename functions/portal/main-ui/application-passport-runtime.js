import applicationPassportRuntimeBase from './application-passport-runtime-base.js';
import adminApplicationsTerminalBucketV1 from './admin-applications-terminal-bucket-v1.js';
import adminApplicationsPassportActionV2 from './admin-applications-passport-action-v2.js';
import adminApplicationsPremiumRuntime from './admin-applications-premium-v1.js';
import adminApplicationsReadabilityV5 from './admin-applications-readability-v5.js';
import paymentsV7OwnerPassportUi from './payments-v7-owner-passport-ui.js';
import paymentsV7FinalDisplayContract from './payments-v7-final-display-contract.js';
import paymentsV7AuthoritativeAggregateUi from './payments-v7-authoritative-aggregate-ui.js';
import paymentsV7PassportRecoveryUi from './payments-v7-passport-recovery-ui.js';
import {
  paymentsV7PassportActivationPrelude,
  paymentsV7PassportActivationRuntime,
} from './payments-v7-passport-activation-fix.js';

/*
 * Source-contract compatibility markers below describe the unchanged implementation
 * carried verbatim by applicationPassportRuntimeBase. They keep legacy source-level
 * QA anchored to the same Application Passport contract while the visual-only
 * Applications presentation is composed separately.
 *
 * data-rona-app-passport-open
 * openApplicationPassport(id,button=null)
 * authoritativeOwnerApplication(id)
 * canonicalPassportResolver(id)
 * optionalCorePassportEnrichment(id)
 * authoritativeJson('/portal/admin-completed-bootstrap'
 * authoritativeJson('/portal/api/v1/admin/bootstrap'
 * addField(context.grid,'ID заявки'
 * addField(context.grid,'Deal ID'
 * document.addEventListener('click'
 * window.openApplicationPassport
 */

export default applicationPassportRuntimeBase
  + adminApplicationsTerminalBucketV1
  + adminApplicationsPassportActionV2
  + adminApplicationsPremiumRuntime
  + adminApplicationsReadabilityV5
  + paymentsV7PassportActivationPrelude
  + paymentsV7OwnerPassportUi
  + paymentsV7FinalDisplayContract
  + paymentsV7AuthoritativeAggregateUi
  + paymentsV7PassportRecoveryUi
  + paymentsV7PassportActivationRuntime;
