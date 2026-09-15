# TermRunway 💸

> **A student-focused budget planning web application.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge)](https://termrunway.netlify.app/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange?style=for-the-badge)](https://github.com/BoyidapuMaheshBabu/TermRunway)

TermRunway helps students understand their income, expenses, remaining balance, and a practical daily spending limit for the time left in a semester or month.

**🌐 [Open the live app →](https://termrunway.netlify.app/)**

## What It Does

- Tracks multiple income sources and expense categories
- Supports semester and monthly budgeting
- Calculates income, expenses, remaining balance, and daily spending limits
- Includes a 50/30/20 budgeting reference
- Saves budget data in the browser using `localStorage`
- Provides reset and print/PDF-friendly options
- Adapts to mobile, tablet, and desktop screens
- Validates input and handles common edge cases

## How It Works

```text
Income + Expenses
       ↓
Remaining Balance
       ↓
Time Remaining
       ↓
Daily Spending Limit
```

The application handles situations such as missing dates, expired periods, zero income, expenses exceeding available funds, and invalid numeric input.

## What I Learned

TermRunway is also part of my project-based learning journey.

I use projects to encounter problems that I do not already know how to solve, then learn the concepts or tools needed to continue.

While building TermRunway, this led me to work with areas such as:

- application logic and calculations
- input validation and edge cases
- date handling
- JSON-based data representation
- browser `localStorage` and data persistence
- responsive layouts
- print/PDF-friendly output
- maintaining and improving an existing application

The project therefore represents both a practical application and a record of learning through implementation.

## Development Approach

TermRunway was built incrementally with AI assistance.

I use AI as a development and learning tool to explore unfamiliar implementation details, understand problems, generate or modify code, debug issues, and iterate on features.

The project is not presented as line-by-line manual coding without AI assistance. The value for me is in **building, encountering problems, learning what is needed, testing, and improving the application**.

## Technology

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript

### Browser APIs

- `localStorage`
- DOM APIs
- Date handling
- Browser print functionality

### Development & Deployment

- Git
- GitHub
- Netlify

## Project Structure

```text
TermRunway/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── README.md
```

## Testing & Improvements

Changes are tested in the browser as features are added or modified.

Examples of issues addressed during development include:

- monthly date calculations
- expired semester dates
- negative remaining balances
- numeric input validation
- desktop layout problems
- mobile responsiveness
- print/PDF layout

## Roadmap

Planned improvements may include:

- more detailed budget analytics
- charts and spending insights
- additional export options
- accessibility improvements
- more student-focused planning tools

The roadmap may change as the project evolves.

## 👨‍💻 Developer

**Boyidapu Mahesh Babu**  
Diploma in Computer Science Engineering student

GitHub: [@BoyidapuMaheshBabu](https://github.com/BoyidapuMaheshBabu)

---

**Built incrementally as a practical learning project.**
