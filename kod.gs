/**
 * Apps Script ortamında çalıştırılacak fonksiyonlar.
 */

// Web uygulaması olarak doğrudan çağrıldığında HTML içeriğini döndürür.
function doGet() {
  return HtmlService.createTemplateFromFile('Dashboard').evaluate()
      .setTitle('Finans Takip Paneli');
}

// Menü oluşturma fonksiyonu (Sheets için)
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Finans Takip')
      .addItem('Paneli Aç (Sheets)', 'openDashboard')
      .addSeparator()
      .addItem('Yeni Ay Oluştur', 'createNewMonthSheet')
      .addItem('Gelir Ekle', 'addTransactionDialog')
      .addItem('Gider Ekle', 'addTransactionDialog')
      .addItem('Alınacak Ekle', 'addTodoItemDialog')
      .addToUi();
}

/**
 * Ana gösterge paneli HTML'ini açar (Sheets içi Modal).
 */
function openDashboard() {
  const htmlOutput = HtmlService.createTemplateFromFile('Dashboard').evaluate()
      .setTitle('Finans Takip Paneli');
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Finans Takip Paneli');
}

/**
 * Belirtilen HTML sayfasını yükler ve döndürür.
 */
function loadPage(pageName) {
  try {
    return HtmlService.createTemplateFromFile(pageName).evaluate();
  } catch (e) {
    Logger.log(`Hata: ${pageName}.html dosyası bulunamadı: ${e.message}`);
    return HtmlService.createHtmlOutput('<h1>Hata: Sayfa bulunamadı.</h1><p>' + e.message + '</p>');
  }
}

/**
 * Ayarlar sayfasını bulur. Yoksa hata verir.
 */
function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Ayarlar');
  if (!settingsSheet) {
    throw new Error('"Ayarlar" adında bir sayfa bulunamadı.');
  }
  return settingsSheet;
}

function getIncomeCategories() {
  try {
    const settingsSheet = getSettingsSheet();
    const categories = settingsSheet.getRange('A2:A' + settingsSheet.getLastRow()).getValues();
    return categories.flat().filter(String);
  } catch (e) { return []; }
}

function getExpenseCategories() {
  try {
    const settingsSheet = getSettingsSheet();
    const categories = settingsSheet.getRange('B2:B' + settingsSheet.getLastRow()).getValues();
    return categories.flat().filter(String);
  } catch (e) { return []; }
}

function getPaymentSources() {
  try {
    const settingsSheet = getSettingsSheet();
    const sources = settingsSheet.getRange('D2:D' + settingsSheet.getLastRow()).getValues();
    return sources.flat().filter(String);
  } catch (e) { return []; }
}

function getRecurringExpenses() {
  try {
    const settingsSheet = getSettingsSheet();
    const lastRow = settingsSheet.getLastRow();
    if (lastRow < 3) return [];
    const range = settingsSheet.getRange('F3:N' + lastRow);
    const values = range.getValues();
    const expenses = [];
    values.forEach((row, index) => {
      if (row[0]) {
        expenses.push({
          id: index + 3, name: row[0], category: row[1], amount: parseFloat(row[2] || 0),
          paymentSource: row[3],
          startDate: row[4] ? Utilities.formatDate(new Date(row[4]), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '',
          endDate: row[5] ? Utilities.formatDate(new Date(row[5]), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '',
          totalInstallments: parseInt(row[6] || 0), remainingInstallments: parseInt(row[7] || 0), lastAddedMonth: row[8] || ''
        });
      }
    });
    return expenses;
  } catch (e) { return []; }
}

function getSettingsData() {
  return {
    incomeCategories: getIncomeCategories(),
    expenseCategories: getExpenseCategories(),
    paymentSources: getPaymentSources(),
    recurringExpenses: getRecurringExpenses()
  };
}

function saveSettingsData(data) {
  try {
    const settingsSheet = getSettingsSheet();
    settingsSheet.getRange('A2:A').clearContent();
    if (data.incomeCategories && data.incomeCategories.length > 0) {
      settingsSheet.getRange(2, 1, data.incomeCategories.length, 1).setValues(data.incomeCategories.map(c => [c]));
    }
    settingsSheet.getRange('B2:B').clearContent();
    if (data.expenseCategories && data.expenseCategories.length > 0) {
      settingsSheet.getRange(2, 2, data.expenseCategories.length, 1).setValues(data.expenseCategories.map(c => [c]));
    }
    settingsSheet.getRange('D2:D').clearContent();
    if (data.paymentSources && data.paymentSources.length > 0) {
      settingsSheet.getRange(2, 4, data.paymentSources.length, 1).setValues(data.paymentSources.map(s => [s]));
    }
    if (settingsSheet.getLastRow() > 2) {
      settingsSheet.getRange('F3:N' + settingsSheet.getLastRow()).clearContent();
    }
    if (data.recurringExpenses && data.recurringExpenses.length > 0) {
      const values = data.recurringExpenses.map(exp => [
        exp.name, exp.category, parseFloat(exp.amount), exp.paymentSource,
        exp.startDate, exp.endDate, parseInt(exp.totalInstallments), 
        parseInt(exp.remainingInstallments), exp.lastAddedMonth
      ]);
      settingsSheet.getRange(3, 6, values.length, values[0].length).setValues(values);
    }
    return { success: true, message: 'Ayarlar başarıyla güncellendi!' };
  } catch (e) {
    return { success: false, message: `Ayarlar güncellenirken hata oluştu: ${e.message}` };
  }
}

/**
 * E-Tablodaki tüm ayların listesini döndürür (en yeniden en eskiye sıralı).
 */
function getMonthsList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const months = [];
  const excludedNames = ['Şablon', 'Ayarlar', 'Script'];

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (!excludedNames.includes(sheetName) && /\b(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s\d{4}\b/.test(sheetName)) {
      months.push({ name: sheetName });
    }
  });

  months.sort((a, b) => {
    const monthMap = { "Ocak": 0, "Şubat": 1, "Mart": 2, "Nisan": 3, "Mayıs": 4, "Haziran": 5, "Temmuz": 6, "Ağustos": 7, "Eylül": 8, "Ekim": 9, "Kasım": 10, "Aralık": 11 };
    const [monthA, yearA] = a.name.split(' ');
    const [monthB, yearB] = b.name.split(' ');
    const dateA = new Date(yearA, monthMap[monthA]);
    const dateB = new Date(yearB, monthMap[monthB]);
    return dateB - dateA;
  });

  return months;
}

/**
 * Veri çekilecek olan en güncel ay sayfasını bulur.
 */
function getLatestMonthSheet() {
    const allMonths = getMonthsList();
    if (allMonths.length === 0) {
        throw new Error("Hiçbir ay sayfası bulunamadı. Lütfen 'Yeni Ay Oluştur' menüsünü kullanarak bir sayfa oluşturun.");
    }
    const latestMonthName = allMonths[0].name;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(latestMonthName);
    if (!sheet) {
      throw new Error("En güncel ay sayfası ('" + latestMonthName + "') bulunamadı.");
    }
    return sheet;
}

/**
 * Belirtilen sayfadaki tüm işlem verilerini getirir.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Verilerin alınacağı sayfa.
 */
function getAllTransactions(sheet) {
  const range = sheet.getRange('A2:G14');
  const values = range.getValues();
  const transactions = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0] && !row[1]) continue;
    let date = row[0];
    if (date instanceof Date) {
        date = Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd MMMM yyyy, EEEE');
    }
    transactions.push({
      date: date.toString(), type: row[1], category: row[2], description: row[3],
      amount: parseFloat(row[4] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      amountRaw: parseFloat(row[4] || 0), paymentSource: row[5], notes: row[6]
    });
  }
  return transactions.sort((a,b) => new Date(b.date) - new Date(a.date));
}

/**
 * Belirtilen sayfadaki alınacaklar listesi verilerini getirir.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Verilerin alınacağı sayfa.
 */
function getAllTodoItems(sheet) {
  const todoListStartRow = 17;
  const lastRow = sheet.getLastRow();
  if (lastRow < todoListStartRow) return [];
  const range = sheet.getRange(todoListStartRow, 1, lastRow - todoListStartRow + 1, 3);
  const values = range.getValues();
  const todoItems = [];
  values.forEach((row, index) => {
    if (!row[0]) return;
    todoItems.push({
      id: todoListStartRow + index, product: row[0],
      price: parseFloat(row[1] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      priceRaw: parseFloat(row[1] || 0), purchased: row[2] === true
    });
  });
  return todoItems.reverse();
}

/**
 * Dashboard'a tüm verileri tek çağrıda almak için ana fonksiyon.
 */
function getDashboardData() {
    try {
        const sheet = getLatestMonthSheet(); // GÜVENİLİR YÖNTEM
        
        const transactions = getAllTransactions(sheet);
        const todoItems = getAllTodoItems(sheet);
        const categoriesAndSources = getSettingsData();
        
        const totalIncome = sheet.getRange('G1').getValue();
        const totalExpense = sheet.getRange('G2').getValue();
        const netBalance = sheet.getRange('G3').getValue();
        const currentMonthName = sheet.getName();

        const expenseCategoryData = {};
        transactions.forEach(t => {
            if (t.type === 'Gider') {
                expenseCategoryData[t.category] = (expenseCategoryData[t.category] || 0) + t.amountRaw;
            }
        });
        const categoryChartData = Object.keys(expenseCategoryData).map(category => ({
            name: category, value: expenseCategoryData[category]
        })).sort((a, b) => b.value - a.value).slice(0, 4);

        const historicalData = {
            months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'],
            income: [18500, 20100, 19800, 22400, 23500, 24600],
            expense: [14200, 15800, 16500, 17200, 18100, 18300]
        };

        return {
            currentMonthName: currentMonthName,
            todayDate: Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd MMMM yyyy, EEEE'),
            totalIncome: totalIncome.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
            totalExpense: totalExpense.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
            netBalance: netBalance.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
            transactions: transactions, 
            todoItems: todoItems,
            categoriesAndSources: categoriesAndSources,
            expenseCategoryChartData: categoryChartData,
            historicalData: historicalData
        };
    } catch (e) {
        Logger.log("getDashboardData HATA: " + e.message);
        return { error: true, message: e.message };
    }
}


/**
 * Yeni bir ay sayfası oluşturur.
 */
function createNewMonthSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const templateSheet = ss.getSheetByName('Şablon');
    if (!templateSheet) throw new Error('"Şablon" adında bir sayfa bulunamadı.');

    const today = new Date();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const newSheetName = `${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    const existingSheet = ss.getSheetByName(newSheetName);
    if (existingSheet) {
      existingSheet.activate();
      return { success: false, message: `${newSheetName} sayfası zaten mevcut.` };
    }
    
    const newSheet = templateSheet.copyTo(ss).setName(newSheetName);
    setSheetHeaders(newSheet);
    setupSummaryFormulas(newSheet);
    newSheet.activate();
    
    return { success: true, message: `${newSheetName} sayfası başarıyla oluşturuldu!` };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * Belirtilen sayfaya başlıkları ekler.
 */
function setSheetHeaders(sheet) {
  const headers = ['Tarih', 'Tür (Gelir/Gider)', 'Kategori', 'Açıklama', 'Miktar', 'Ödeme Kaynağı', 'Not'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.getRange(15, 1).setValue('Alınacaklar Listesi').setFontWeight('bold');
  const todoHeaders = ['Ürün/Hizmet', 'Fiyat', 'Satın Alındı?'];
  sheet.getRange(16, 1, 1, todoHeaders.length).setValues([todoHeaders]).setFontWeight('bold');
  sheet.getRange(17, 3, sheet.getMaxRows() - 17, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sayfanın üst kısmına özet formüllerini ekler.
 */
function setupSummaryFormulas(sheet) {
  sheet.getRange('F1').setValue('Toplam Gelir').setFontWeight('bold');
  sheet.getRange('F2').setValue('Toplam Gider').setFontWeight('bold');
  sheet.getRange('F3').setValue('Net Bakiye').setFontWeight('bold');
  sheet.getRange('G1').setFormula('=SUMIF(B2:B14, "Gelir", E2:E14)');
  sheet.getRange('G2').setFormula('=SUMIF(B2:B14, "Gider", E2:E14)');
  sheet.getRange('G3').setFormula('=G1-G2');
  sheet.getRange('G1:G3').setNumberFormat('₺#,##0.00');
}

/**
 * Bir işlemi belirtilen sayfaya ekler.
 */
function addTransactionToSheet(sheet, date, type, category, description, amount, paymentSource, notes) {
  const transactionAreaEndRow = 14;
  let firstEmptyRow = -1;
  const range = sheet.getRange('A2:A' + transactionAreaEndRow).getValues();
  for(let i=0; i < range.length; i++){
    if(range[i][0] === ''){
      firstEmptyRow = i + 2;
      break;
    }
  }
  if (firstEmptyRow === -1) {
    sheet.insertRowsAfter(1, 1);
    firstEmptyRow = 2;
  }
  sheet.getRange(firstEmptyRow, 1, 1, 7).setValues([[date, type, category, description, amount, paymentSource, notes]]);
}

/**
 * Form verilerini işler ve sayfaya ekler.
 */
function processTransactionForm(formObject) {
  try {
    const sheet = getLatestMonthSheet(); // HATAYI ÖNLE
    const date = formObject.date ? new Date(formObject.date) : new Date();
    const formattedDate = Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd.MM.yyyy');
    const amount = parseFloat(formObject.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Miktar geçerli bir sayı olmalı ve sıfırdan büyük olmalıdır.');
    }
    addTransactionToSheet(sheet, formattedDate, formObject.type, formObject.category, formObject.description, amount, formObject.paymentSource, formObject.notes);
    return { success: true, message: `${formObject.type} başarıyla eklendi!` };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * TodoItemForm verilerini işler ve sayfaya ekler.
 */
function processTodoItemForm(formObject) {
  try {
    const sheet = getLatestMonthSheet(); // HATAYI ÖNLE
    const price = parseFloat(formObject.price);

    if (isNaN(price) || price < 0) {
      throw new Error('Fiyat geçerli bir sayı olmalıdır.');
    }
    const todoListStartRow = 17;
    const lastRow = sheet.getLastRow();
    let firstEmptyTodoRow = sheet.getRange('A' + todoListStartRow).getValue() ? lastRow + 1 : todoListStartRow;
    for (let i = todoListStartRow; i <= lastRow + 1; i++) {
        if (sheet.getRange(i, 1).getValue() === '') {
            firstEmptyTodoRow = i;
            break;
        }
    }
    sheet.getRange(firstEmptyTodoRow, 1, 1, 3).setValues([[formObject.product, price, false]]);
    return { success: true, message: `"${formObject.product}" listeye eklendi!` };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * Yapılacaklar listesi öğesinin durumunu günceller.
 */
function updateTodoItemPurchaseStatus(rowId, purchased) {
  try {
    const sheet = getLatestMonthSheet(); // HATAYI ÖNLE
    sheet.getRange(rowId, 3).setValue(purchased);
    return { success: true, message: 'Durum güncellendi.' };
  } catch (e) {
    return { success: false, message: `Hata: ${e.message}` };
  }
}


// Diğer UI ve form fonksiyonları (addTransactionDialog vb.) buraya eklenebilir.
// Lütfen kendi dosyanızdan eksik olanları tamamlayın.
// Örneğin: addTransactionDialog, addTodoItemDialog vb.

function addTransactionDialog() {
  const htmlTemplate = HtmlService.createTemplateFromFile('IncomeExpenseForm');
  htmlTemplate.data = getSettingsData();
  htmlTemplate.initialType = 'Gider';
  const htmlOutput = htmlTemplate.evaluate().setWidth(400).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Gelir/Gider Ekle');
}

function addTodoItemDialog() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile('TodoItemForm').setWidth(400).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Alınacak Ekle');
}
