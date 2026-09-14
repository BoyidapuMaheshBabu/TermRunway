# TermRunway 💸

> **A student-focused budget planning web application.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C853?style=for-the-badge)](https://termrunway.netlify.app/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange?style=for-the-badge)](https://github.com/BoyidapuMaheshBabu/TermRunway)

**Live App:** https://termrunway.netlify.app/

---

## Overview

TermRunway helps students plan income and expenses, understand their remaining balance, and estimate a practical daily spending limit for the time remaining in a semester.

The project is intentionally evolving as I learn more about frontend development, application logic, validation, data persistence, and software maintenance.

## Features

- Multiple income sources and expense categories
- Semester and monthly budgeting modes
- Automatic income, expense, balance, and daily-limit calculations
- 50/30/20 budgeting reference
- Persistent browser storage with `localStorage`
- Reset budget functionality
- Printable / PDF-friendly budget summary
- Responsive mobile, tablet, and desktop layouts
- Input validation and edge-case handling
- Student-focused dashboard UI

## Calculation Flow

```text
Income + Planned Expenses
          ↓
    Remaining Balance
          ↓
   Time Remaining
          ↓
 Daily Spending Limit
```

The application also handles cases such as missing dates, expired semester dates, zero income, expenses exceeding available funds, and invalid numeric input.

## Technology Stack

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

## Development & Testing

TermRunway is maintained through incremental development. Changes are tested in the browser while features are added or modified.

Examples of issues addressed during development include:

- Monthly date calculations
- Expired semester dates
- Negative remaining balances
- Number-input validation
- Desktop layout problems
- Mobile responsiveness
- Print/PDF layout

## Roadmap

Planned improvements may include:

- More detailed budget analytics
- Charts and spending insights
- Additional export options
- Accessibility improvements
- More student-focused planning tools
- Further validation and testing

The roadmap may change as the project evolves.

## Live Demo

**[Open TermRunway →](https://termrunway.netlify.app/)**

## Developer

**Boyidapu Mahesh Babu**  
Diploma in Computer Science Engineering student

GitHub: [@BoyidapuMaheshBabu](https://github.com/BoyidapuMaheshBabu)

---

**Built as a practical learning project and improved through continuous development.**
