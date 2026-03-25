# Sistema de Validacao de Conteudo Institucional

Projeto em PowerShell com arquitetura modular para validar textos institucionais a partir de:

- historico de posts antigos
- regras de brandbook
- pipeline de validadores independentes

## Estrutura

- `src/Validators`: validadores modulares
- `src/Services`: ingestao, perfil de escrita, regras de brand e pipeline
- `data/reference-posts`: base inicial de referencia
- `data/brandbook`: regras seed para uso imediato
- `Start-ContentValidationApi.ps1`: API `POST /validate`
- `examples/run-sample.ps1`: execucao de exemplo

## UI e endpoint

Ao subir o servidor, a interface web fica em:

`GET http://localhost:8080/`

O endpoint continua disponivel em:

`POST http://localhost:8080/validate`

Payload JSON:

```json
{
  "text": "texto a validar",
  "reference_paths": [
    "C:\\caminho\\para\\posts",
    "C:\\caminho\\para\\post.docx"
  ],
  "brandbook_path": "C:\\caminho\\para\\brandbook.pdf"
}
```

## Execucao local

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-ContentValidationApi.ps1
```

Em outro terminal:

```powershell
Invoke-RestMethod -Uri http://localhost:8080/validate -Method Post -ContentType 'application/json' -Body (@{
  text = 'Texto institucional para validar.'
  reference_paths = @('.\data\reference-posts')
  brandbook_path = 'C:\Users\ChianelloAna(BipGrou\Downloads\BIP Brand Guidelines 2025 (1).pdf'
} | ConvertTo-Json)
```

## Observacoes

- `.docx` e texto plano sao suportados nativamente.
- `.pdf` usa fallback textual sem dependencia externa. Quando houver parser PDF dedicado disponivel no ambiente, ele pode ser plugado em `src/Services/TextExtractionService.psm1`.
- O sistema aceita atualizacao dinamica do brandbook e da base de posts por caminho informado no request.
