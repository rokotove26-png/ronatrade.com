export const OPENAPI_SPEC = {
  "openapi": "3.1.0",
  "info": {
    "title": "RONA Trade ↔ BelTrade Desk — Agency-Scoped Read-Only Partner API",
    "version": "1.1.0",
    "description": "Extension of the existing BelTrade API using the same opaque Bearer key. Every business row must pass the existing per-resource can_read permission, exact per-object active grant AND a current agency addendum to an explicitly granted Deal under InCom agency agreement 351C2026. No other agency or client Deals, bank account details, unconfirmed trade prices, unverified payment allocations, private storage paths or write methods. Source-received agency addenda are not asserted legally verified. Revocations stop future reads immediately; partners must poll /v1/scope and purge cached IDs removed from scope. Previously downloaded files cannot be remotely recalled."
  },
  "servers": [
    {
      "url": "https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-beltrade-partner-v1"
    }
  ],
  "tags": [
    {
      "name": "Public",
      "description": "Unauthenticated health and published API specification"
    },
    {
      "name": "Partner",
      "description": "Authenticated readonly metadata and revocation reconciliation"
    },
    {
      "name": "Resources",
      "description": "Exact agency and entity scoped record reads only"
    },
    {
      "name": "Files",
      "description": "Authenticated private file proxy with per-request authority and audit checks"
    }
  ],
  "components": {
    "securitySchemes": {
      "PartnerBearer": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "opaque",
        "description": "Existing BelTrade server-side Bearer key; never put token in query parameters, browser, public logs or OpenAPI."
      }
    },
    "parameters": {
      "Resource": {
        "name": "resource",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "enum": [
            "applications",
            "deals",
            "payments",
            "documents",
            "wagons"
          ]
        }
      },
      "EntityId": {
        "name": "id",
        "in": "path",
        "required": true,
        "schema": {
          "type": "string",
          "format": "uuid"
        }
      },
      "Limit": {
        "name": "limit",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100,
          "default": 25
        }
      },
      "Offset": {
        "name": "offset",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 0,
          "maximum": 10000,
          "default": 0
        }
      },
      "UpdatedSince": {
        "name": "updated_since",
        "in": "query",
        "schema": {
          "type": "string",
          "format": "date-time"
        },
        "description": "Return current authorized records changed after this UTC timestamp. Use with stable paginated offset, and /v1/scope for revocation."
      },
      "Since": {
        "name": "since",
        "in": "query",
        "required": true,
        "schema": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "schemas": {
      "Error": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean",
            "const": false
          },
          "code": {
            "type": "string"
          },
          "request_id": {
            "type": "string",
            "format": "uuid"
          }
        }
      },
      "ResourcePermission": {
        "type": "object",
        "properties": {
          "resource": {
            "type": "string"
          },
          "read": {
            "type": "boolean"
          },
          "create": {
            "type": "boolean",
            "const": false
          },
          "update": {
            "type": "boolean",
            "const": false
          }
        }
      },
      "Application": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "reference": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "product": {
            "type": [
              "string",
              "null"
            ]
          },
          "quantity_tonnes": {
            "type": [
              "string",
              "null"
            ]
          },
          "proposed_price": {
            "type": [
              "string",
              "null"
            ],
            "description": "From client application; NOT a confirmed contract price."
          },
          "proposed_currency": {
            "type": [
              "string",
              "null"
            ]
          },
          "counterparty_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "linked_deal_reference": {
            "type": [
              "string",
              "null"
            ]
          },
          "contract_reference": {
            "type": [
              "string",
              "null"
            ]
          },
          "delivery_basis": {
            "type": [
              "string",
              "null"
            ]
          },
          "destination": {
            "type": [
              "string",
              "null"
            ]
          },
          "delivery_period_from": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "delivery_period_to": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "origin_station_code": {
            "type": "null",
            "description": "Not confirmed in canonical application; never inferred."
          },
          "destination_station_code": {
            "type": "null",
            "description": "Not confirmed in canonical application; never inferred."
          },
          "price_authority": {
            "type": "string",
            "const": "APPLICATION_PROPOSAL_NOT_SIGNED_TRADE_PRICE"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Deal": {
        "type": "object",
        "description": "Only an individually granted Deal with a current matching agency addendum. Unrelated and unlinked Deals are never returned.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "reference": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "counterparty_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "contract_reference": {
            "type": [
              "string",
              "null"
            ]
          },
          "linked_application_reference": {
            "type": [
              "string",
              "null"
            ]
          },
          "product": {
            "type": [
              "string",
              "null"
            ]
          },
          "quantity_tonnes": {
            "type": [
              "string",
              "null"
            ]
          },
          "proposed_price": {
            "type": [
              "string",
              "null"
            ]
          },
          "proposed_currency": {
            "type": [
              "string",
              "null"
            ]
          },
          "price_authority": {
            "type": "string"
          },
          "delivery_basis": {
            "type": [
              "string",
              "null"
            ]
          },
          "destination": {
            "type": [
              "string",
              "null"
            ]
          },
          "delivery_period_from": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "delivery_period_to": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Payment": {
        "type": "object",
        "description": "Only finance VERIFIED payment with confirmed, active, VERIFIED allocations to in-scope Deals. No bank accounts.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "reference": {
            "type": "string"
          },
          "verification_status": {
            "type": "string"
          },
          "currency": {
            "type": "string"
          },
          "payment_date": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "payer_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "beneficiary_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "agency_verified_amount": {
            "type": "string"
          },
          "deal_allocations": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "deal_reference": {
                  "type": "string"
                },
                "allocated_amount": {
                  "type": "string"
                },
                "allocation_status": {
                  "type": "string"
                }
              }
            }
          },
          "payment_purpose": {
            "type": [
              "string",
              "null"
            ],
            "description": "Null if payment is not exclusively and fully allocated within authorised agency scope."
          },
          "amount_authority": {
            "type": "string",
            "const": "VERIFIED_ALLOCATION_IN_AGENCY_SCOPE_ONLY"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Document": {
        "type": "object",
        "description": "Metadata is provided for exact granted document of a scoped deal. Binary only for confirmed active effective current verified private version.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "reference": {
            "type": "string"
          },
          "type": {
            "type": "string"
          },
          "filename": {
            "type": [
              "string",
              "null"
            ]
          },
          "linked_deal_reference": {
            "type": "string"
          },
          "version_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "version_number": {
            "type": [
              "integer",
              "null"
            ]
          },
          "is_current": {
            "type": "boolean"
          },
          "is_effective": {
            "type": "boolean"
          },
          "superseded_by_version_id": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          },
          "authority_state": {
            "type": "string"
          },
          "lifecycle_state": {
            "type": "string"
          },
          "download_available": {
            "type": "boolean"
          },
          "download_url": {
            "type": [
              "string",
              "null"
            ]
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Wagon": {
        "type": "object",
        "description": "Only exact granted wagons linked by canonical shipment to an InCom agency-scoped granted Deal; none currently granted.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "reference": {
            "type": "string"
          },
          "status": {
            "type": "string"
          },
          "current_station_name": {
            "type": [
              "string",
              "null"
            ]
          },
          "current_station_code": {
            "type": [
              "string",
              "null"
            ]
          },
          "position_time": {
            "type": [
              "string",
              "null"
            ],
            "format": "date-time"
          },
          "position_source": {
            "type": [
              "string",
              "null"
            ]
          },
          "linked_shipment_reference": {
            "type": [
              "string",
              "null"
            ]
          },
          "linked_deal_reference": {
            "type": "string"
          },
          "origin_station": {
            "type": [
              "string",
              "null"
            ]
          },
          "destination_station": {
            "type": [
              "string",
              "null"
            ]
          },
          "updated_at": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Scope": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean"
          },
          "contract_version": {
            "type": "string"
          },
          "agency_scope": {
            "type": "string",
            "const": "INKOM_351C2026"
          },
          "revision": {
            "type": "string",
            "description": "Hash of currently readable IDs, not a permission grant."
          },
          "resources": {
            "type": "object",
            "description": "Complete currently visible ID manifest by category; revoke absent cached IDs."
          },
          "cache_rule": {
            "type": "string"
          }
        }
      },
      "Changes": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean"
          },
          "since": {
            "type": "string",
            "format": "date-time"
          },
          "snapshot_at": {
            "type": "string",
            "format": "date-time"
          },
          "changes": {
            "type": "object",
            "description": "Current granted rows changed since timestamp; reconcile with /v1/scope to detect revocation."
          },
          "cache_rule": {
            "type": "string"
          }
        }
      }
    },
    "responses": {
      "Unauthorized": {
        "description": "Invalid, expired or revoked key; existing partner key is retained unless independently revoked",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "Forbidden": {
        "description": "Not permitted category or exact record",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "RateLimited": {
        "description": "Rate limit 60 requests/minute per partner",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      },
      "Unavailable": {
        "description": "Fail-closed audit or runtime / private storage error",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Error"
            }
          }
        }
      }
    }
  },
  "paths": {
    "/health": {
      "get": {
        "tags": [
          "Public"
        ],
        "security": [],
        "summary": "API reachable",
        "responses": {
          "200": {
            "description": "Reachable, no business data"
          }
        }
      }
    },
    "/openapi.json": {
      "get": {
        "tags": [
          "Public"
        ],
        "security": [],
        "summary": "Latest machine-readable OpenAPI 3.1 contract",
        "responses": {
          "200": {
            "description": "OpenAPI specification"
          }
        }
      }
    },
    "/v1/catalog": {
      "get": {
        "tags": [
          "Partner"
        ],
        "security": [
          {
            "PartnerBearer": []
          }
        ],
        "summary": "Existing permissions, agency scope and read-only contract version",
        "responses": {
          "200": {
            "description": "Partner catalog"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          }
        }
      }
    },
    "/v1/scope": {
      "get": {
        "tags": [
          "Partner"
        ],
        "security": [
          {
            "PartnerBearer": []
          }
        ],
        "summary": "Full current manifest and hash of granted agency-linked record UUIDs",
        "description": "Poll after every sync. Remove locally cached IDs absent from this manifest. Token or grant revocation takes immediate effect for future reads.",
        "responses": {
          "200": {
            "description": "Current complete scope manifest",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Scope"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "503": {
            "$ref": "#/components/responses/Unavailable"
          }
        }
      }
    },
    "/v1/changes": {
      "get": {
        "tags": [
          "Partner"
        ],
        "security": [
          {
            "PartnerBearer": []
          }
        ],
        "summary": "Changed currently permitted records across all five categories",
        "parameters": [
          {
            "$ref": "#/components/parameters/Since"
          }
        ],
        "description": "Returns up to 100 changes per resource; for larger sets use paginated resource list with updated_since. This cannot return deleted/revoked objects—compare /v1/scope.",
        "responses": {
          "200": {
            "description": "Current scoped changes",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Changes"
                }
              }
            }
          },
          "400": {
            "description": "Missing or invalid since timestamp"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "409": {
            "description": "One category exceeds 100 changes; paginate it"
          }
        }
      }
    },
    "/v1/{resource}": {
      "get": {
        "tags": [
          "Resources"
        ],
        "security": [
          {
            "PartnerBearer": []
          }
        ],
        "summary": "Only exact granted records inside current InCom agency Deals",
        "parameters": [
          {
            "$ref": "#/components/parameters/Resource"
          },
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "$ref": "#/components/parameters/Offset"
          },
          {
            "$ref": "#/components/parameters/UpdatedSince"
          }
        ],
        "description": "Existing endpoints remain stable, but additional fields are returned only for an InCom agency linked and deal-granted record. An application’s proposed_price must not be interpreted as signed contract price; finance amount includes only verified in-scope allocations.",
        "responses": {
          "200": {
            "description": "Authorized list, resource-specific typed fields: Application, Deal, Payment, Document, Wagon"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          },
          "503": {
            "$ref": "#/components/responses/Unavailable"
          }
        }
      }
    },
    "/v1/{resource}/{id}": {
      "get": {
        "tags": [
          "Resources"
        ],
        "security": [
          {
            "PartnerBearer": []
          }
        ],
        "summary": "Read one exact permitted in-scope entity",
        "parameters": [
          {
            "$ref": "#/components/parameters/Resource"
          },
          {
            "$ref": "#/components/parameters/EntityId"
          }
        ],
        "responses": {
          "200": {
            "description": "Typed in-scope entity"
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "description": "Not in permitted InCom scope"
          }
        }
      }
    },
    "/v1/documents/{id}/download": {
      "get": {
        "tags": [
          "Files"
        ],
        "security": [
          {
            "PartnerBearer": []
          }
        ],
        "summary": "Download verified effective current version via private audited proxy",
        "description": "Download only of explicitly granted document, linked to a current InCom agency Deal, with confirmed active document + version and VERIFIED file in a private Supabase bucket. Storage path and service key are never returned; no signed public links. Cache-Control no-store. Revoking key/grants disables future requests.",
        "parameters": [
          {
            "$ref": "#/components/parameters/EntityId"
          }
        ],
        "responses": {
          "200": {
            "description": "Binary attachment; Content-Disposition attachment, X-RONA-Document-Version",
            "content": {
              "application/octet-stream": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/Unauthorized"
          },
          "403": {
            "$ref": "#/components/responses/Forbidden"
          },
          "404": {
            "description": "No current confirmed verified permitted binary"
          },
          "413": {
            "description": "Document exceeds safe response limit"
          },
          "503": {
            "$ref": "#/components/responses/Unavailable"
          }
        }
      }
    }
  }
};
