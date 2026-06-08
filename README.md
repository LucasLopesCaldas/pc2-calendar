# pc2-calendar

Calendário estático com escala de trabalho personalizável.

## Como usar

1. Abra o `index.html` no navegador
2. Clique em **⚙️ Configurar Escala**
3. Selecione a **data de início do ciclo** (primeiro dia do padrão)
4. Escolha o **primeiro dia da semana** (Domingo, Segunda-feira, etc.)
5. Monte o **padrão da escala** clicando nos botões:
   - **+ Dia de Trabalho** — adiciona um dia de trabalho ao padrão
   - **+ Dia de Folga** — adiciona um dia de folga ao padrão
6. Escolha uma **paleta de cores** sugerida ou personalize as cores individualmente
7. Clique em **Aplicar e Gerar Calendário**

### Exemplos de padrão

| Escala | Padrão a configurar |
|--------|---------------------|
| 12×36  | 1 trabalho, 1 folga |
| 5×2    | 5 trabalho, 2 folga |
| 6×1    | 6 trabalho, 1 folga |
| 24×48  | 1 trabalho, 2 folga |

### Funcionalidades

- **Primeiro dia da semana personalizável** — escolha qualquer dia como início da semana
- **Paletas de cores sugeridas** — 8 temas pré-definidos (Padrão, Oceano, Floresta, Lavanda, Pôr do Sol, Monocromático, Neon, Terra)
- **Nomes de feriados** — feriados brasileiros são indicados diretamente nas células do calendário
- **Modal de detalhes** — clique em qualquer dia para ver informações detalhadas (data, dia da semana, escala, feriado)
- **Feriados brasileiros** — feriados nacionais fixos e móveis (Carnaval, Páscoa, Corpus Christi, etc.)

A configuração é salva no navegador (localStorage) e será lembrada nas próximas visitas.
