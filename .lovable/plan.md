

## Revisão do Dump de Migração

### O que JÁ está incluído (OK)
- **Schema completo**: 126 tabelas com tipos, defaults, constraints
- **10 enums customizados** (app_role, lead_status, message_media_type, etc.)
- **Functions**: 1320 linhas (todas as funções do schema public)
- **Triggers**: todos os triggers existentes
- **RLS policies**: 617 linhas (ENABLE + CREATE POLICY)
- **Foreign keys, indexes, views**: arquivos separados
- **Dados**: 54 tabelas com registros exportadas em CSV (as demais ~72 tabelas estão vazias no banco)

### O que está FALTANDO

1. **Storage Buckets** — 7 buckets públicos precisam ser criados:
   - `logos`, `audios-predefinidos`, `instagram-media`, `public-assets`, `comprovantes`, `membros-fotos`, `tarefa-grid`
   - Vou gerar um `10_storage_buckets.sql` com os INSERTs em `storage.buckets` e as policies de acesso público

2. **Edge Functions** — O código das ~70 edge functions já está no repositório (`supabase/functions/`), mas não foi incluído no tar.gz. Vou empacotar tudo junto.

3. **Secrets** — As variáveis de ambiente (API keys, tokens) usadas pelas edge functions não podem ser exportadas, mas vou gerar uma lista de todos os secrets necessários para configuração manual.

4. **auth.users** — Tabela do sistema Supabase, não acessível para export. Usuários precisarão ser recriados manualmente no destino.

5. **Arquivos do Storage** — Arquivos físicos (logos, áudios, imagens) dentro dos buckets não podem ser exportados via SQL.

### Plano de Implementação

| Passo | Ação | Arquivo |
|-------|------|---------|
| 1 | Gerar SQL de criação dos 7 storage buckets + policies públicas | `10_storage_buckets.sql` |
| 2 | Copiar todas as edge functions para o pacote | `edge_functions/` |
| 3 | Gerar lista de secrets necessários | `SECRETS_NEEDED.txt` |
| 4 | Reempacotar tudo em um novo `migration_completa_v2.tar.gz` | Arquivo final |

### Resultado Final
O pacote atualizado conterá:
- 10 arquivos SQL (schema + storage)
- Diretório `data/` com 54 CSVs
- Diretório `edge_functions/` com todo o código
- `SECRETS_NEEDED.txt` com lista de configuração
- `00_IMPORT_ORDER.txt` atualizado

