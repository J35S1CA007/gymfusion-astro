CREATE TABLE IF NOT EXISTS better_auth_identity_mapping (
  better_auth_user_id TEXT PRIMARY KEY NOT NULL,
  fusion_id TEXT NOT NULL UNIQUE,
  wix_member_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (better_auth_user_id) REFERENCES user(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_better_auth_identity_mapping_status
  ON better_auth_identity_mapping(status);

