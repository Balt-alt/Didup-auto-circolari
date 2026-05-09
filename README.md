# Didup auto-circolari

[![GitHub stars](https://img.shields.io/github/stars/Balt-alt/Didup-auto-circolari?style=social)](https://github.com/Balt-alt/Didup-auto-circolari/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Balt-alt/Didup-auto-circolari?style=social)](https://github.com/Balt-alt/Didup-auto-circolari/forks)
[![GitHub issues](https://img.shields.io/github/issues/Balt-alt/Didup-auto-circolari)](https://github.com/Balt-alt/Didup-auto-circolari/issues)
[![Last commit](https://img.shields.io/github/last-commit/Balt-alt/Didup-auto-circolari)](https://github.com/Balt-alt/Didup-auto-circolari/commits/main)
[![Userscript](https://img.shields.io/badge/Tampermonkey-userscript-00485b)](didup-auto-circolari.user.js)

Userscript Tampermonkey per automatizzare la presa visione delle circolari su Argo/Didup.

## Cosa fa

- Scorre progressivamente la lista delle circolari con virtual scroll ExtJS.
- Apre la scheda degli allegati quando presente.
- Clicca il primo allegato disponibile.
- Torna alla lista.
- Conferma la presa visione.

## Installazione

1. Installa Tampermonkey su Firefox o Chrome.
2. Apri il file `didup-auto-circolari.user.js`.
3. Copia il contenuto in un nuovo script Tampermonkey, oppure aprilo da GitHub raw e installalo.
4. Vai nella sezione Circolari di Argo/Didup.
5. Premi `Avvia presa visione` dal pannello che compare in alto a destra.

## Nota su Firefox

Se Firefox mostra una finestra per chiedere cosa fare con ogni PDF o documento, Tampermonkey non puo chiuderla automaticamente: e una finestra del browser/sistema, fuori dalla pagina web.

Per evitare blocchi, imposta in Firefox un comportamento predefinito per PDF, Word, Excel e altri allegati:

- `Impostazioni`
- `Applicazioni`
- scegli `Apri in Firefox`, `Salva file` o un'applicazione predefinita per ogni tipo di file
- disattiva `Chiedi dove salvare ogni file` se necessario

## Versione

Versione corrente dello userscript: `4.1`.
