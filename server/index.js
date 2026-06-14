import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Only the local Vite dev origin may call the API. This blocks other browser
// origins (e.g. a malicious site you have open) from reading responses.
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({ origin: ALLOWED_ORIGINS, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

// Defense-in-depth against localhost CSRF: reject state-changing requests whose
// Origin (browsers always set it on cross-origin writes) isn't allow-listed, so
// a third-party page can't silently tamper with entries or the payee config.
app.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const origin = req.get('origin');
        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
            return res.status(403).json({ error: 'Cross-origin request blocked' });
        }
    }
    next();
});

// Path to the Excel file (in the root of the project)
const EXCEL_FILE_PATH = path.join(__dirname, '..', 'Tracker.xlsx');

// Path to the runtime config (personal details). config.json is gitignored;
// config.example.json is the committed template used to seed it on first run.
const CONFIG_FILE_PATH = path.join(__dirname, '..', 'config.json');
const CONFIG_EXAMPLE_PATH = path.join(__dirname, '..', 'config.example.json');

// Helper to read Excel file
const readExcel = () => {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
        // Create a new file if it doesn't exist
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, EXCEL_FILE_PATH);
        return [];
    }

    const workbook = XLSX.readFile(EXCEL_FILE_PATH, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
};

// Helper to write to Excel file
const writeExcel = (data) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, EXCEL_FILE_PATH);
};

// Helper to read the runtime config, seeding from the example template on first run
const readConfig = () => {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
        const seed = fs.existsSync(CONFIG_EXAMPLE_PATH)
            ? fs.readFileSync(CONFIG_EXAMPLE_PATH, 'utf-8')
            : '{}';
        fs.writeFileSync(CONFIG_FILE_PATH, seed);
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
};

// Helper to write the runtime config
const writeConfig = (config) => {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
};

// ---- Input validation -----------------------------------------------------

// Thrown for bad client input so routes can answer 400 instead of 500.
class ValidationError extends Error {}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Neutralize spreadsheet formula injection: a leading =, +, @ (or control char)
// can execute as a formula when Tracker.xlsx is opened. Prefix such values with
// a quote. (A leading '-' is left alone — too common in normal task text.)
const sanitizeCell = (value) => {
    const str = String(value);
    return /^[=+@\t\r]/.test(str) ? `'${str}` : str;
};

// Validate a work entry and return a clean object with only the known columns.
const validateEntry = (body) => {
    if (!isPlainObject(body)) throw new ValidationError('Entry must be an object');

    const task = typeof body.Task === 'string' ? body.Task.trim() : '';
    if (!task) throw new ValidationError('Task is required');
    if (task.length > 200) throw new ValidationError('Task must be 200 characters or fewer');

    const description = typeof body.Description === 'string' ? body.Description : '';
    if (description.length > 2000) throw new ValidationError('Description must be 2000 characters or fewer');

    const date = typeof body.Date === 'string' ? body.Date.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ValidationError('Date must be in YYYY-MM-DD format');

    const hours = Number(body.Hours);
    if (!Number.isFinite(hours) || hours < 0) throw new ValidationError('Hours must be a number of 0 or more');

    const invoice = typeof body.Invoice === 'string' ? body.Invoice.trim() : '';
    if (invoice.length > 50) throw new ValidationError('Invoice must be 50 characters or fewer');

    return {
        Task: sanitizeCell(task),
        Description: sanitizeCell(description),
        Date: date,
        Hours: hours,
        Invoice: sanitizeCell(invoice),
    };
};

// Validate the runtime config and return a clean object (drops unknown keys).
const validateConfig = (body) => {
    if (!isPlainObject(body)) throw new ValidationError('Config must be an object');
    const { contractor, client, payment, payPeriod } = body;
    if (![contractor, client, payment, payPeriod].every(isPlainObject)) {
        throw new ValidationError('Config must include contractor, client, payment and payPeriod objects');
    }

    const str = (v, max = 200) => {
        const s = typeof v === 'string' ? v.trim() : '';
        if (s.length > max) throw new ValidationError('A config value is too long');
        return s;
    };
    const email = (v) => {
        const s = str(v, 254);
        if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ValidationError('Invalid email address');
        return s;
    };

    const hourlyRate = Number(payment.hourlyRate);
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) throw new ValidationError('hourlyRate must be a number of 0 or more');

    const periodLengthDays = Number(payPeriod.periodLengthDays);
    if (!Number.isInteger(periodLengthDays) || periodLengthDays < 1) throw new ValidationError('periodLengthDays must be a positive integer');

    const paymentDaysAfterPeriodEnd = Number(payPeriod.paymentDaysAfterPeriodEnd);
    if (!Number.isInteger(paymentDaysAfterPeriodEnd) || paymentDaysAfterPeriodEnd < 0) throw new ValidationError('paymentDaysAfterPeriodEnd must be a non-negative integer');

    const referenceStartDate = str(payPeriod.referenceStartDate, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceStartDate)) throw new ValidationError('referenceStartDate must be in YYYY-MM-DD format');

    return {
        contractor: {
            name: str(contractor.name),
            email: email(contractor.email),
            paymentEmail: email(contractor.paymentEmail),
        },
        client: {
            name: str(client.name),
            address: str(client.address),
            city: str(client.city),
            province: str(client.province),
            postalCode: str(client.postalCode),
            country: str(client.country),
        },
        payment: {
            hourlyRate,
            currency: str(payment.currency, 10),
            currencySymbol: str(payment.currencySymbol, 5),
        },
        payPeriod: {
            referenceStartDate,
            periodLengthDays,
            paymentDaysAfterPeriodEnd,
        },
    };
};

// GET all entries
app.get('/api/entries', (req, res) => {
    try {
        const data = readExcel();
        res.json(data);
    } catch (error) {
        console.error("Error reading excel:", error);
        res.status(500).json({ error: "Failed to read data" });
    }
});

// POST new entry
app.post('/api/entries', (req, res) => {
    try {
        const newEntry = validateEntry(req.body);
        const currentData = readExcel();
        const updatedData = [...currentData, newEntry];
        writeExcel(updatedData);

        res.json({ message: "Entry added successfully", data: updatedData });
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Error writing excel:", error);
        res.status(500).json({ error: "Failed to save data" });
    }
});

// PUT (update) entry
app.put('/api/entries/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const currentData = readExcel();

        if (!(index >= 0 && index < currentData.length)) {
            return res.status(400).json({ error: "Invalid index" });
        }

        currentData[index] = validateEntry(req.body);
        writeExcel(currentData);
        res.json({ message: "Entry updated successfully", data: currentData });
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Error updating entry:", error);
        res.status(500).json({ error: "Failed to update entry" });
    }
});

// DELETE entry
app.delete('/api/entries/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const currentData = readExcel();
        
        if (index >= 0 && index < currentData.length) {
            const updatedData = currentData.filter((_, i) => i !== index);
            writeExcel(updatedData);
            res.json({ message: "Entry deleted successfully", data: updatedData });
        } else {
            res.status(400).json({ error: "Invalid index" });
        }
    } catch (error) {
        console.error("Error deleting entry:", error);
        res.status(500).json({ error: "Failed to delete entry" });
    }
});

// GET runtime config (contractor, client, payment, pay-period settings)
app.get('/api/config', (req, res) => {
    try {
        res.json(readConfig());
    } catch (error) {
        console.error("Error reading config:", error);
        res.status(500).json({ error: "Failed to read config" });
    }
});

// PUT (replace) runtime config — used by the in-app settings
app.put('/api/config', (req, res) => {
    try {
        const config = validateConfig(req.body);
        writeConfig(config);
        res.json(readConfig());
    } catch (error) {
        if (error instanceof ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Error writing config:", error);
        res.status(500).json({ error: "Failed to save config" });
    }
});

// Bind to loopback only — this is a personal, single-user local tool.
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});
