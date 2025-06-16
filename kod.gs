/**
 * Apps Script ortamında çalıştırılacak fonksiyonlar.
 */

// Web uygulaması olarak doğrudan çağrıldığında HTML içeriğini döndürür.
// Bu fonksiyon, bir web uygulaması olarak dağıtım yapıldığında çalışır.
function doGet() {
  return HtmlService.createTemplateFromFile('Dashboard').evaluate()
      .setTitle('Finans Takip Paneli');
      // .setFaviconUrl('https://www.google.com/s2/favicons?domain=sheets.google.com'); // Favicon hatası için yorumlandı
}

// Menü oluşturma fonksiyonu (Sheets için)
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Finans Takip')
      .addItem('Paneli Aç (Sheets)', 'openDashboard') // Sheets içinde modal olarak aç
      .addSeparator() // Ayırıcı
      .addItem('Yeni Ay Oluştur', 'createNewMonthSheet')
      .addItem('Gelir Ekle', 'addTransactionDialog')
      .addItem('Gider Ekle', 'addTransactionDialog')
      .addItem('Alınacak Ekle', 'addTodoItemDialog')
      .addToUi();
}

/**
 * Ana gösterge paneli HTML'ini açar (Sheets içi Modal).
 * Bu fonksiyon, Sheets menüsünden çağrıldığında bir modal diyalog açar.
 */
function openDashboard() {
  const htmlOutput = HtmlService.createTemplateFromFile('Dashboard').evaluate()
      .setTitle('Finans Takip Paneli');
      // .setFaviconUrl('https://www.google.com/s2/favicons?domain=sheets.google.com'); // Favicon hatası için yorumlandı

  // Geliştirme ve hızlı test için: Sheets içinde modal olarak aç
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Finans Takip Paneli');
}

/**
 * Belirtilen HTML sayfasını yükler ve döndürür.
 * Web uygulamasında sayfa geçişleri için kullanılır.
 * @param {string} pageName - Yüklenecek HTML şablon dosyasının adı (uzantısız).
 * @returns {HtmlOutput} Yüklenen HTML içeriği.
 */
function loadPage(pageName) {
  try {
    return HtmlService.createTemplateFromFile(pageName).evaluate();
  } catch (e) {
    Logger.log(`Hata: ${pageName}.html dosyası bulunamadı veya işlenirken hata oluştu: ${e.message}`);
    return HtmlService.createHtmlOutput('<h1>Hata: Sayfa bulunamadı veya yüklenemedi.</h1><p>' + e.message + '</p>');
  }
}

/**
 * Ayarlar sayfasını bulur. Yoksa hata verir.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Ayarlar sayfası.
 */
function getSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Ayarlar');
  if (!settingsSheet) {
    throw new Error('Hata: "Ayarlar" adında bir sayfa bulunamadı. Lütfen Ayarlar sayfasını oluşturun.');
  }
  return settingsSheet;
}

/**
 * Ayarlar sayfasından gelir kategorilerini okur.
 * @returns {string[]} Gelir kategorileri listesi.
 */
function getIncomeCategories() {
  try {
    const settingsSheet = getSettingsSheet();
    const categories = settingsSheet.getRange('A2:A' + settingsSheet.getLastRow()).getValues();
    return categories.flat().filter(String);
  } catch (e) {
    Logger.log(`getIncomeCategories hata: ${e.message}`);
    return [];
  }
}

/**
 * Ayarlar sayfasından gider kategorilerini okur.
 * @returns {string[]} Gider kategorileri listesi.
 */
function getExpenseCategories() {
  try {
    const settingsSheet = getSettingsSheet();
    const categories = settingsSheet.getRange('B2:B' + settingsSheet.getLastRow()).getValues();
    return categories.flat().filter(String);
  } catch (e) {
    Logger.log(`getExpenseCategories hata: ${e.message}`);
    return [];
  }
}

/**
 * Ayarlar sayfasından banka/ödeme kaynaklarını okur.
 * @returns {string[]} Banka/ödeme kaynakları listesi.
 */
function getPaymentSources() {
  try {
    const settingsSheet = getSettingsSheet();
    const sources = settingsSheet.getRange('D2:D' + settingsSheet.getLastRow()).getValues();
    return sources.flat().filter(String);
  } catch (e) {
    Logger.log(`getPaymentSources hata: ${e.message}`);
    return [];
  }
}

/**
 * Ayarlar sayfasından tekrarlayan giderleri okur.
 * @returns {object[]} Tekrarlayan giderler listesi.
 */
function getRecurringExpenses() {
  try {
    const settingsSheet = getSettingsSheet();
    const lastRow = settingsSheet.getLastRow();
    if (lastRow < 3) return []; // Başlıklar F1:N2, veriler F3'ten başlar
    
    // F: Gider Adı, G: Kategori, H: Miktar, I: Ödeme Kaynağı, J: Başlangıç Tarihi, K: Bitiş Tarihi,
    // L: Toplam Taksit Sayısı, M: Kalan Taksit Sayısı, N: Son Eklenen Ay
    const range = settingsSheet.getRange('F3:N' + lastRow);
    const values = range.getValues();
    const expenses = [];

    values.forEach((row, index) => {
      if (row[0]) { // Gider Adı boş değilse
        expenses.push({
          id: index + 3, // Satır numarası olarak kullanılabilir
          name: row[0],
          category: row[1],
          amount: parseFloat(row[2] || 0),
          paymentSource: row[3],
          startDate: row[4] ? Utilities.formatDate(new Date(row[4]), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '',
          endDate: row[5] ? Utilities.formatDate(new Date(row[5]), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '',
          totalInstallments: parseInt(row[6] || 0),
          remainingInstallments: parseInt(row[7] || 0),
          lastAddedMonth: row[8] || ''
        });
      }
    });
    return expenses;
  } catch (e) {
    Logger.log(`getRecurringExpenses hata: ${e.message}`);
    return [];
  }
}


/**
 * Hem gelir, gider kategorilerini, ödeme kaynaklarını ve tekrarlayan giderleri tek bir çağrıda döndürür.
 * HTML şablonlarına veri aktarımı için kullanılır.
 * @returns {object} {income: string[], expense: string[], sources: string[], recurringExpenses: object[]} formatında listeler.
 */
function getSettingsData() {
  return {
    incomeCategories: getIncomeCategories(),
    expenseCategories: getExpenseCategories(),
    paymentSources: getPaymentSources(),
    recurringExpenses: getRecurringExpenses()
  };
}

/**
 * Ayarlar sayfasındaki verileri günceller.
 * @param {object} data - Güncellenecek verileri içeren obje.
 * { incomeCategories: [], expenseCategories: [], paymentSources: [] }
 * @returns {object} Başarı durumu ve mesaj.
 */
function saveSettingsData(data) {
  try {
    const settingsSheet = getSettingsSheet();

    // Gelir Kategorileri (A sütunu)
    const incomeCategoriesRange = settingsSheet.getRange('A2:A');
    incomeCategoriesRange.clearContent();
    if (data.incomeCategories && data.incomeCategories.length > 0) {
      settingsSheet.getRange(2, 1, data.incomeCategories.length, 1).setValues(data.incomeCategories.map(c => [c]));
    }

    // Gider Kategorileri (B sütunu)
    const expenseCategoriesRange = settingsSheet.getRange('B2:B');
    expenseCategoriesRange.clearContent();
    if (data.expenseCategories && data.expenseCategories.length > 0) {
      settingsSheet.getRange(2, 2, data.expenseCategories.length, 1).setValues(data.expenseCategories.map(c => [c]));
    }

    // Ödeme Kaynakları (D sütunu)
    const paymentSourcesRange = settingsSheet.getRange('D2:D');
    paymentSourcesRange.clearContent();
    if (data.paymentSources && data.paymentSources.length > 0) {
      settingsSheet.getRange(2, 4, data.paymentSources.length, 1).setValues(data.paymentSources.map(s => [s]));
    }
    
    // Tekrarlayan Giderler (F:N)
    // Mevcut tekrarlayan giderleri temizle
    settingsSheet.getRange('F3:N' + settingsSheet.getLastRow()).clearContent();
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
    Logger.log(`saveSettingsData hata: ${e.message}`);
    return { success: false, message: `Ayarlar güncellenirken hata oluştu: ${e.message}` };
  }
}

/**
 * Mevcut ay sayfasındaki tüm işlem verilerini getirir.
 * Dashboard için kullanılır.
 * @returns {object[]} İşlem listesi.
 */
function getAllTransactions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getRange('A2:G' + sheet.getLastRow()); // Başlıklar hariç A'dan G'ye kadar
  const values = range.getValues();
  const transactions = [];

  for (let i = 0; i < values.length; i++) {
    // Alınacaklar listesi başlangıcına kadar olan satırları dikkate al (15. satırın altı)
    if (i + 2 >= 15) break; 
    
    const row = values[i];
    // Boş satırları atla
    if (!row[0] && !row[1] && !row[2] && !row[3] && !row[4] && !row[5] && !row[6]) {
        continue;
    }

    // Tarih objesini doğru formatla
    let date = row[0];
    if (date instanceof Date) {
        date = Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd MMMM yyyy, EEEE'); // 16 Haziran 2025, Pazartesi
    } else {
        date = String(date); // Tarih formatında değilse string olarak al
    }

    transactions.push({
      date: date,
      type: row[1],
      category: row[2],
      description: row[3],
      amount: parseFloat(row[4] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), // 2 ondalık basamak, TR formatı
      amountRaw: parseFloat(row[4] || 0), // Hesaplamalar için orijinal değer
      paymentSource: row[5],
      notes: row[6]
    });
  }
  return transactions.reverse(); // En yeni işlemler üstte olsun
}


/**
 * Mevcut ay sayfasındaki tüm alınacaklar listesi verilerini getirir.
 * Dashboard için kullanılır.
 * @returns {object[]} Alınacaklar listesi.
 */
function getAllTodoItems() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const todoListStartRow = 16; 
  const lastRow = sheet.getLastRow();
  
  if (lastRow < todoListStartRow) return []; // Liste boş

  const range = sheet.getRange(todoListStartRow, 1, lastRow - todoListStartRow + 1, 3);
  const values = range.getValues();
  const todoItems = [];

  values.forEach((row, index) => {
    if (!row[0] && !row[1] && !row[2]) return; // Boş satırları atla

    todoItems.push({
      id: todoListStartRow + index, // Satır numarası
      product: row[0],
      price: parseFloat(row[1] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      priceRaw: parseFloat(row[1] || 0), // Hesaplamalar için orijinal değer
      purchased: row[2] === '✅' ? true : false
    });
  });
  return todoItems.reverse(); // En yeni öğeler üstte olsun
}

/**
 * Dashboard'a tüm verileri tek çağrıda almak için fonksiyon
 * @returns {object} Dashboard için gerekli tüm veriler.
 */
function getDashboardData() {
  const transactions = getAllTransactions();
  const todoItems = getAllTodoItems();
  google.script.run.withSuccessHandler(function(data) {
    // data içinde gelir/gider kategorileri var
    console.log(data);
  }).getListsForHtml();

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const totalIncome = sheet.getRange('G1').getValue();
  const totalExpense = sheet.getRange('G2').getValue();
  const netBalance = sheet.getRange('G3').getValue();

  const currentMonthName = sheet.getName(); // Sayfa adını doğrudan al

  // Harcama Kategorileri için veri hazırlığı (ilk 4'ü örnek, gerçek veriden gelecek)
  const expenseCategoryData = {};
  transactions.forEach(t => {
      if (t.type === 'Gider') {
          expenseCategoryData[t.category] = (expenseCategoryData[t.category] || 0) + t.amountRaw;
      }
  });

  const categoryChartData = Object.keys(expenseCategoryData).map(category => ({
      name: category,
      value: expenseCategoryData[category]
  }));
    // En yüksekten en düşüğe sırala ve ilk 4'ü al
  categoryChartData.sort((a, b) => b.value - a.value);
  const top4Categories = categoryChartData.slice(0, 4);


  // Geçmiş ay verileri için şimdilik örnek veri, sonra gerçek veritabanından çekilebilir
  const historicalData = {
    months: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'],
    income: [18500, 20100, 19800, 22400, 23500, 24600], // Örnek veri
    expense: [14200, 15800, 16500, 17200, 18100, 18300] // Örnek veri
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
    expenseCategoryChartData: top4Categories, // İlk 4 harcama kategorisi
    historicalData: historicalData // Gelir/Gider analizi için geçmiş veriler
  };
}


/**
 * Yeni bir ay sayfası oluşturur.
 * Eğer ay sayfası zaten varsa, tekrar oluşturmaz.
 * Şablon sayfasını kopyalar ve yeni ay adıyla kaydeder.
 */
function createNewMonthSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const templateSheet = ss.getSheetByName('Şablon');

  if (!templateSheet) {
    SpreadsheetApp.getUi().alert('Hata', 'Şablon adında bir sayfa bulunamadı. Lütfen "Şablon" adında bir sayfa oluşturun ve içeriğini hazırlayın.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const today = new Date();
  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const currentMonthName = monthNames[today.getMonth()];
  const currentYear = today.getFullYear();
  const newSheetName = `${currentMonthName} ${currentYear}`;

  let newSheet;
  // Sayfanın zaten var olup olmadığını kontrol et
  const existingSheet = ss.getSheetByName(newSheetName);
  if (existingSheet) {
    SpreadsheetApp.getUi().alert('Bilgi', `${newSheetName} sayfası zaten mevcut. Mevcut sayfa açılıyor.`, SpreadsheetApp.getUi().ButtonSet.OK);
    newSheet = existingSheet;
  } else {
    // Şablonu kopyala ve yeni ad ver
    newSheet = templateSheet.copyTo(ss);
    newSheet.setName(newSheetName);
    
    // Başlıkları ve formülleri ayarla
    setSheetHeaders(newSheet);
    setupSummaryFormulas(newSheet);

    SpreadsheetApp.getUi().alert('Başarılı', `${newSheetName} sayfası başarıyla oluşturuldu!`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
  
  newSheet.activate(); // Yeni veya mevcut sayfayı aktif yap
  addRecurringExpenses(newSheet, newSheetName); // Tekrarlayan giderleri ekle
  openNewMonthInitialForm(); // Aylık gelir/gider formunu aç
}

/**
 * Belirtilen sayfaya başlıkları ekler.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Başlıkların ekleneceği sayfa.
 */
function setSheetHeaders(sheet) {
  const headers = ['Tarih', 'Tür (Gelir/Gider)', 'Kategori', 'Açıklama', 'Miktar', 'Ödeme Kaynağı', 'Not'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // Alınacaklar Listesi başlığı ve kolonları
  sheet.getRange(15, 1).setValue('Alınacaklar Listesi').setFontWeight('bold');
  const todoHeaders = ['Ürün/Hizmet', 'Fiyat', 'Satın Alındı? (✅/❌)'];
  sheet.getRange(16, 1, 1, todoHeaders.length).setValues([todoHeaders]).setFontWeight('bold');

  // Kolon genişliklerini ayarla
  sheet.autoResizeColumns(1, headers.length);
  sheet.autoResizeColumns(1, todoHeaders.length);
}

/**
 * Sayfanın üst kısmına aylık toplam gelir, gider ve net bakiye formüllerini ekler.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Formüllerin ekleneceği sayfa.
 */
function setupSummaryFormulas(sheet) {
  // Başlıklar
  sheet.getRange('F1').setValue('Toplam Gelir').setFontWeight('bold');
  sheet.getRange('F2').setValue('Toplam Gider').setFontWeight('bold');
  sheet.getRange('F3').setValue('Net Bakiye').setFontWeight('bold');

  // Formüller
  // Gelir (B sütununda "Gelir" olan ve E sütunundaki miktarları topla)
  sheet.getRange('G1').setFormula('=SUMIF(B:B, "Gelir", E:E)');
  // Gider (B sütununda "Gider" olan ve E sütunundaki miktarları topla)
  sheet.getRange('G2').setFormula('=SUMIF(B:B, "Gider", E:E)');
  // Net Bakiye
  sheet.getRange('G3').setFormula('=G1-G2');

  // Para birimi formatını ayarla (örnek: ₺)
  sheet.getRange('G1:G3').setNumberFormat('₺#,##0.00');
}

/**
 * Tekrarlayan giderleri "Ayarlar" sayfasından okur ve yeni oluşturulan aya ekler.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} targetSheet - İşlemlerin ekleneceği hedef sayfa.
 * @param {string} newSheetName - Yeni oluşturulan sayfanın adı (örn: "Haziran 2025").
 */
function addRecurringExpenses(targetSheet, newSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('Ayarlar');
  if (!settingsSheet) {
    SpreadsheetApp.getUi().alert('Hata', 'Ayarlar sayfası bulunamadı. Tekrarlayan giderler eklenemedi.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // F2:N2 = Gider Adı, Kategori, Miktar, Ödeme Kaynağı, Başlangıç Tarihi, Bitiş Tarihi, Toplam Taksit Sayısı, Kalan Taksit Sayısı, Son Eklenen Ay
  const recurringExpensesRange = settingsSheet.getRange('F3:N' + settingsSheet.getLastRow());
  const recurringExpenses = recurringExpensesRange.getValues();

  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();
  const formattedToday = Utilities.formatDate(today, ss.getSpreadsheetTimeZone(), 'dd.MM.yyyy');

  let expensesAddedCount = 0;

  for (let i = 0; i < recurringExpenses.length; i++) {
    const row = recurringExpenses[i];
    const expenseName = row[0]; // Gider Adı (F sütunu)
    const category = row[1];    // Kategori (G sütunu)
    const amount = parseFloat(row[2]); // Miktar (H sütunu)
    const paymentSource = row[3]; // Ödeme Kaynağı (I sütunu)
    const startDate = row[4] ? new Date(row[4]) : null; // Başlangıç Tarihi (J sütunu)
    const endDate = row[5] ? new Date(row[5]) : null;   // Bitiş Tarihi (K sütunu)
    const totalInstallments = parseInt(row[6]); // Toplam Taksit Sayısı (L sütunu)
    let remainingInstallments = parseInt(row[7]); // Kalan Taksit Sayısı (M sütunu)
    let lastAddedMonth = row[8]; // Son Eklenen Ay (N sütunu)

    if (isNaN(amount) || amount <= 0 || !expenseName || !category) {
      continue; // Geçersiz satırları atla
    }

    // Başlangıç tarihi kontrolü
    if (startDate && startDate.getTime() > today.getTime()) {
      continue; // Daha başlamamış bir gider
    }

    // Bitiş tarihi kontrolü
    if (endDate && endDate.getTime() < today.getTime()) {
      continue; // Bitiş tarihi geçmiş bir gider
    }

    // Eğer taksitli ise ve taksit sayısı bitmişse ekleme
    if (!isNaN(totalInstallments) && totalInstallments > 0) {
      if (isNaN(remainingInstallments) || remainingInstallments <= 0) {
        continue; // Taksit sayısı bitmiş
      }
      // Kalan taksit sayısı sıfırsa ve toplam taksit varsa, başlangıç değerini al (ilk kez ekleniyorsa)
      if (isNaN(remainingInstallments) || remainingInstallments === 0 && totalInstallments > 0) {
          remainingInstallments = totalInstallments;
      }
    }
    
    // Aynı aya birden fazla eklemeyi engelle
    if (lastAddedMonth === newSheetName) {
        continue; // Bu gider bu aya zaten eklenmiş
    }
    
    // Gideri ekle
    addTransactionToSheet(targetSheet, formattedToday, 'Gider', category, expenseName, amount, paymentSource, 'Otomatik eklendi');
    expensesAddedCount++;

    // "Ayarlar" sayfasındaki "Kalan Taksit Sayısı" ve "Son Eklenen Ay" sütunlarını güncelle
    // Sadece taksitli giderler için kalan taksiti düşür
    if (!isNaN(totalInstallments) && totalInstallments > 0) {
      remainingInstallments--;
      settingsSheet.getRange(i + 3, 13).setValue(remainingInstallments); // M sütunu (13. sütun)
    }
    settingsSheet.getRange(i + 3, 14).setValue(newSheetName); // N sütunu (14. sütun)
  }

  if (expensesAddedCount > 0) {
    SpreadsheetApp.getUi().alert('Bilgi', `${expensesAddedCount} adet tekrarlayan gider başarıyla eklendi.`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * İşlem ekleme (Gelir/Gider) için bir diyalog formu açar.
 * Hangi butonun tıklandığına göre işlem türünü belirler.
 * @param {string} [initialType] - Başlangıçta seçili gelecek işlem türü ('Gelir' veya 'Gider').
 */
function addTransactionDialog(initialTypeFromMenu) {
  const ui = SpreadsheetApp.getUi();
  
  let transactionType;
  // Eğer menüden veya doğrudan bir type ile çağrıldıysa
  if (typeof initialTypeFromMenu === 'string' && (initialTypeFromMenu === 'Gelir' || initialTypeFromMenu === 'Gider')) {
    transactionType = initialTypeFromMenu;
  } else if (arguments[0] && arguments[0].menuItem === 'Gelir Ekle') {
    transactionType = 'Gelir';
  } else if (arguments[0] && arguments[0].menuItem === 'Gider Ekle') {
    transactionType = 'Gider';
  } else {
    // Hiçbir type belirtilmediyse kullanıcıya sor
    const result = ui.alert('İşlem Türü', 'Bu bir gelir mi yoksa gider mi?', ui.ButtonSet.YES_NO);
    if (result === ui.Button.YES) {
      transactionType = 'Gelir';
    } else if (result === ui.Button.NO) {
      transactionType = 'Gider';
    } else {
      return;
    }
  }

  const htmlTemplate = HtmlService.createTemplateFromFile('IncomeExpenseForm'); // Yeni HTML adı
  htmlTemplate.data = getListsForHtml(); // Tüm listeleri tek nesne olarak gönder
  htmlTemplate.initialType = transactionType;

  const htmlOutput = htmlTemplate.evaluate()
      .setWidth(400)
      .setHeight(500); 
  
  ui.showModalDialog(htmlOutput, `${transactionType} Ekle`);
}

/**
 * TransactionForm.html dosyasındaki form verilerini işler ve sayfaya ekler.
 * @param {object} formObject - Formdan gelen veriler.
 */
function processTransactionForm(formObject) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  let date;
  try {
    date = new Date(formObject.date);
    if (isNaN(date.getTime())) {
      date = new Date();
    }
  } catch (e) {
    date = new Date();
  }
  
  const formattedDate = Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd.MM.yyyy');
  const type = formObject.type;
  const category = formObject.category;
  const description = formObject.description;
  const amount = parseFloat(formObject.amount);
  const paymentSource = formObject.paymentSource;
  const notes = formObject.notes;

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Miktar geçerli bir sayı olmalı ve sıfırdan büyük olmalıdır.');
  }

  addTransactionToSheet(sheet, formattedDate, type, category, description, amount, paymentSource, notes);
  
  // Apps Script tarafından çağrıldığında uyarı yerine dönüyoruz
  return { success: true, message: `${type} başarıyla eklendi!` };
}

/**
 * Alınacaklar Listesi'ne öğe eklemek için bir diyalog formu açar.
 */
function addTodoItemDialog() {
  const ui = SpreadsheetApp.getUi();
  const htmlOutput = HtmlService.createHtmlOutputFromFile('TodoItemForm')
      .setWidth(400)
      .setHeight(300);
  
  ui.showModalDialog(htmlOutput, 'Alınacak Ekle');
}

/**
 * TodoItemForm.html dosyasındaki form verilerini işler ve sayfaya ekler.
 * @param {object} formObject - Formdan gelen veriler.
 */
function processTodoItemForm(formObject) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const product = formObject.product;
  const price = parseFloat(formObject.price);
  const purchased = formObject.purchased === 'true' ? '✅' : '❌';

  if (isNaN(price) || price < 0) {
    throw new Error('Fiyat geçerli bir sayı olmalı ve sıfırdan küçük olmamalıdır.');
  }

  const todoListStartRow = 16; 
  const lastRow = sheet.getLastRow();
  
  let firstEmptyTodoRow = -1;
  // Alınacaklar Listesi'nin altına ilk boş satırı bul
  for (let i = todoListStartRow + 1; i <= lastRow + 1; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === '') {
      firstEmptyTodoRow = i;
      break;
    }
  }
  if (firstEmptyTodoRow === -1) {
    firstEmptyTodoRow = lastRow + 1;
  }

  sheet.getRange(firstEmptyTodoRow, 1, 1, 3).setValues([[product, price, purchased]]);

  return { success: true, message: `"${product}" listeye eklendi!` };
}

/**
 * Yapılacaklar listesi öğesinin satın alınma durumunu günceller.
 * @param {number} rowId - Güncellenecek öğenin satır ID'si (sayfadaki satır numarası).
 * @param {boolean} purchased - Satın alındı mı (true) yoksa alınmadı mı (false).
 */
function updateTodoItemPurchaseStatus(rowId, purchased) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const cell = sheet.getRange(rowId, 3); // C sütunu (3. sütun)
    cell.setValue(purchased ? '✅' : '❌');
    return { success: true, message: 'Durum güncellendi.' };
  } catch (e) {
    Logger.log(`updateTodoItemPurchaseStatus hata: ${e.message}`);
    return { success: false, message: `Hata: ${e.message}` };
  }
}

/**
 * Yeni Ay Oluşturulduktan sonra düzenli gelir/giderleri sormak için bir diyalog açar.
 */
function openNewMonthInitialForm() {
  const ui = SpreadsheetApp.getUi();
  
  const htmlTemplate = HtmlService.createTemplateFromFile('NewMonthInitialForm');
  htmlTemplate.data = getSettingsData(); // Ayarlar sayfasından veri al (kategoriler vs)

  const htmlOutput = htmlTemplate.evaluate()
      .setWidth(500)
      .setHeight(600); 
  
  ui.showModalDialog(htmlOutput, 'Aylık Düzenli Gelir/Giderleri Girin');
}

/**
 * NewMonthInitialForm.html dosyasındaki form verilerini işler ve yeni aya ekler.
 * @param {object} formObject - Formdan gelen veriler.
 */
function processNewMonthInitialForm(formObject) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const today = new Date();
  const formattedDate = Utilities.formatDate(today, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd.MM.yyyy');

  // Düzenli Gelir
  if (formObject.monthlyIncomeAmount && parseFloat(formObject.monthlyIncomeAmount) > 0) {
    const amount = parseFloat(formObject.monthlyIncomeAmount);
    const category = formObject.monthlyIncomeCategory || 'Maaş';
    const description = formObject.monthlyIncomeDescription || 'Aylık Düzenli Gelir';
    const paymentSource = formObject.monthlyIncomeSource || '';
    addTransactionToSheet(sheet, formattedDate, 'Gelir', category, description, amount, paymentSource, '');
  }

  // Düzenli Giderler (krediler, faturalar vb.)
  const expenseCount = parseInt(formObject.expenseCount || '0');
  for (let i = 1; i <= expenseCount; i++) {
    const amount = parseFloat(formObject['expenseAmount' + i]);
    if (amount > 0) {
      const category = formObject['expenseCategory' + i] || 'Diğer Giderler';
      const description = formObject['expenseDescription' + i] || 'Düzenli Gider';
      const paymentSource = formObject['expenseSource' + i] || '';
      addTransactionToSheet(sheet, formattedDate, 'Gider', category, description, amount, paymentSource, '');
    }
  }
  return { success: true, message: 'Aylık düzenli gelir/giderler başarıyla kaydedildi!' };
}

/**
 * Bir işlemi belirtilen sayfaya ekler (dahili yardımcı fonksiyon).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - İşlemin ekleneceği sayfa.
 * @param {string} date - Tarih.
 * @param {string} type - Tür (Gelir/Gider).
 * @param {string} category - Kategori.
 * @param {string} description - Açıklama.
 * @param {number} amount - Miktar.
 * @param {string} paymentSource - Ödeme Kaynağı.
 * @param {string} notes - Notlar.
 */
function addTransactionToSheet(sheet, date, type, category, description, amount, paymentSource, notes) {
  const lastRow = sheet.getLastRow();
  let firstEmptyRow = -1;
  // İlk boş satırı bul (Alınacaklar Listesi'nin üstünde, varsayılan 15. satırın üstü)
  for (let i = 2; i <= lastRow + 1; i++) {
    const cellValue = sheet.getRange(i, 1).getValue();
    if (cellValue === '' && i < 15) { 
      firstEmptyRow = i;
      break;
    }
  }

  if (firstEmptyRow === -1 || firstEmptyRow >= 15) {
    // Eğer boş satır bulunamazsa veya Alınacaklar Listesi'ne kadar gelindiyse,
    // yeni bir satır ekleyerek mevcut satırları aşağı kaydır.
    // Başlıkların (satır 1) hemen altına ekliyoruz, böylece Alınacaklar Listesi'ni etkilemiyor.
    sheet.insertRowsAfter(1, 1); 
    firstEmptyRow = 2; // Yeni boş satır 2. satır olacak
  }

  sheet.getRange(firstEmptyRow, 1, 1, 7).setValues([[date, type, category, description, amount, paymentSource, notes]]);
}

/**
 * E-Tablodaki tüm ayların listesini döndürür (Şablon, Ayarlar ve Script hariç).
 * @returns {object[]} Ayların listesi (ad, URL).
 */
function getMonthsList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const months = [];
  const excludedNames = ['Şablon', 'Ayarlar', 'Script']; // Hariç tutulacak sayfa adları

  sheets.forEach(sheet => {
    const sheetName = sheet.getName();
    if (!excludedNames.includes(sheetName)) {
      // Yıl ve ay formatını kontrol et, örneğin "Ocak 2023"
      if (/\b(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s\d{4}\b/.test(sheetName)) {
        months.push({ name: sheetName });
      }
    }
  });

  // Ayları tarihe göre sırala (en yeniden en eskiye)
  months.sort((a, b) => {
    const dateA = new Date(a.name.replace('Ocak', 'Jan').replace('Şubat', 'Feb').replace('Mart', 'Mar').replace('Nisan', 'Apr').replace('Mayıs', 'May').replace('Haziran', 'Jun').replace('Temmuz', 'Jul').replace('Ağustos', 'Aug').replace('Eylül', 'Sep').replace('Ekim', 'Oct').replace('Kasım', 'Nov').replace('Aralık', 'Dec'));
    const dateB = new Date(b.name.replace('Ocak', 'Jan').replace('Şubat', 'Feb').replace('Mart', 'Mar').replace('Nisan', 'Apr').replace('Mayıs', 'May').replace('Haziran', 'Jun').replace('Temmuz', 'Jul').replace('Ağustos', 'Aug').replace('Eylül', 'Sep').replace('Ekim', 'Oct').replace('Kasım', 'Nov').replace('Aralık', 'Dec'));
    return dateB.getTime() - dateA.getTime();
  });

  return months;
}

/**
 * Belirli bir aya geçiş yapar ve o ayın verilerini döndürür.
 * @param {string} monthName - Geçiş yapılacak ayın adı (örn: "Haziran 2025").
 * @returns {object} O ayın dashboard verileri.
 */
function goToMonth(monthName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = ss.getSheetByName(monthName);
    if (targetSheet) {
      targetSheet.activate();
      return getDashboardData(); // Yeni ayın verilerini döndür
    } else {
      throw new Error(`Hata: '${monthName}' adında bir sayfa bulunamadı.`);
    }
  } catch (e) {
    Logger.log(`goToMonth hata: ${e.message}`);
    throw new Error(`Ay değiştirilirken hata oluştu: ${e.message}`);
  }
}

/**
 * Belirli bir temayı kaydeder veya yükler.
 * Şimdilik kullanıcı mülklerine kaydederiz.
 * @param {string} themeName - Kaydedilecek tema adı (örn: 'dark', 'light').
 */
function setTheme(themeName) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('APP_THEME', themeName);
  return { success: true, message: `Tema "${themeName}" olarak ayarlandı.` };
}

/**
 * Kaydedilmiş temayı döndürür.
 * @returns {string} Kaydedilmiş tema adı.
 */
function getTheme() {
  const userProperties = PropertiesService.getUserProperties();
  return userProperties.getProperty('APP_THEME') || 'light'; // Varsayılan tema
}
// Kod.gs

function myFunction() {
  // Bu fonksiyon eğer varsa başlangıçta çalıştırılabilir.
  // Şu an için getListsForHtml fonksiyonuna odaklanacağız.
}

/**
 * Google Sheets'ten Gelir ve Gider kategorilerini alır
 * ve bir JavaScript objesi olarak döndürür.
 * Bu fonksiyon, istemci tarafındaki (HTML) JavaScript tarafından çağrılacaktır.
 */
// Kod.gs

function myFunction() {
  // Bu fonksiyon şimdilik önemli değil, ama boş da bırakılabilir.
}

/**
 * Google Sheets'ten Gelir ve Gider kategorilerini alır
 * ve bir JavaScript objesi olarak döndürür.
 * Bu fonksiyon, istemci tarafındaki (HTML) JavaScript tarafından çağrılacaktır.
 */
function getListsForHtml() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    // BURAYI KONTROL EDİN: 'Ekran Resmi 2025-06-16 00.36.30.png'deki Google Sheets sayfanızın adı ne?
    // Genellikle 'Sayfa1'dir, ama siz değiştirdiyseniz o adı yazmalısınız.
    const sheet = spreadsheet.getSheetByName("Sayfa1"); 

    if (!sheet) {
      console.error("Hata: 'Sayfa1' adında bir sayfa bulunamadı. Lütfen Kod.gs dosyasındaki sayfa adını kontrol edin.");
      return { incomeCategories: [], expenseCategories: [], error: "Kategoriler sayfası bulunamadı." };
    }

    const lastRow = sheet.getLastRow();

    // Gelir Kategorileri (A sütunu, 2. satırdan başlar)
    // getRange(başlangıç_satırı, başlangıç_sütunu, satır_sayısı, sütun_sayısı)
    const incomeRange = sheet.getRange(2, 1, lastRow - 1, 1); 
    const incomeValues = incomeRange.getValues();

    // Gider Kategorileri (B sütunu, 2. satırdan başlar)
    const expenseRange = sheet.getRange(2, 2, lastRow - 1, 1); 
    const expenseValues = expenseRange.getValues();

    const incomeCategories = incomeValues.flat().filter(String); // Boşlukları ve null'ları temizle
    const expenseCategories = expenseValues.flat().filter(String);

    return {
      incomeCategories: incomeCategories,
      expenseCategories: expenseCategories
    };

  } catch (e) {
    console.error("getListsForHtml fonksiyonunda bir hata oluştu: " + e.message);
    return { incomeCategories: [], expenseCategories: [], error: "Sunucu hatası: " + e.message };
  }
}
// Kod.gs

function myFunction() {
  // Mevcut fonksiyonlarınız veya başlangıç ayarları buraya gelebilir.
}

/**
 * Web uygulamasına bir GET isteği yapıldığında otomatik olarak çalışır.
 * Bu fonksiyon, HTML içeriğini web tarayıcısına sunmak için kullanılır.
 * @param {Object} e - Olay objesi (istek parametrelerini içerir)
 * @returns {HtmlOutput} Web tarayıcısına sunulacak HTML içeriği.
 */
function doGet(e) {
  // Dashboard.html dosyasının içeriğini web uygulaması olarak sunar.
  // Dosya adının, projenizdeki HTML dosyasının adıyla tam olarak eşleştiğinden emin olun.
  // (Örneğin, Dosyalar listesindeki "Dashboard.html" gibi)
  return HtmlService.createTemplateFromFile('Dashboard').evaluate(); 
  // Veya DashboardContent.html ise: return HtmlService.createTemplateFromFile('DashboardContent').evaluate();
}

// Daha önce eklediğimiz getListsForHtml fonksiyonu da burada kalmalıdır.
function getListsForHtml() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName("Sayfa1"); // Google Sheets'teki kategori sayfanızın adını kontrol edin.

    if (!sheet) {
      console.error("Hata: 'Sayfa1' adında bir sayfa bulunamadı.");
      return { incomeCategories: [], expenseCategories: [], error: "Kategoriler sayfası bulunamadı." };
    }

    const lastRow = sheet.getLastRow();
    const incomeRange = sheet.getRange(2, 1, lastRow - 1, 1);
    const expenseRange = sheet.getRange(2, 2, lastRow - 1, 1);

    const incomeValues = incomeRange.getValues();
    const expenseValues = expenseRange.getValues();

    const incomeCategories = incomeValues.flat().filter(String);
    const expenseCategories = expenseValues.flat().filter(String);

    return {
      incomeCategories: incomeCategories,
      expenseCategories: expenseCategories
    };

  } catch (e) {
    console.error("getListsForHtml fonksiyonunda bir hata oluştu: " + e.message);
    return { incomeCategories: [], expenseCategories: [], error: "Sunucu hatası: " + e.message };
  }
}
// Diğer sunucu tarafı fonksiyonlarınız (örneğin veri ekleme, veri çekme vb.) buraya gelecektir.
