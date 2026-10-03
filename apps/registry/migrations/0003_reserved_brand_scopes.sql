-- Scopes reservados adicionales de la marca (D1-A-08): variantes del dominio y el handle antiguo de la org.
-- Mismo dueño y regla que 0001 (solo staff de acc_system).
INSERT OR IGNORE INTO scopes (id, registry_id, name, owner_id, git_host, git_owner, is_reserved, created_at) VALUES
  ('scp_genpm_dev', 'reg_public', 'genpm-dev', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_genpm_com', 'reg_public', 'genpm-com', 'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000),
  ('scp_genpmhq',   'reg_public', 'genpmhq',   'acc_system', 'github.com', 'genpm-net', 1, unixepoch() * 1000);
