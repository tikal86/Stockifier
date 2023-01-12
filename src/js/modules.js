const db = require('./js/database')
const electron = require('electron')
const Chart = require('/media/andre/Data/git/repo/Stockifier/node_modules/chart.js/dist/chart.umd')
const BrowserWindow = electron.remote.BrowserWindow
const path = require('path')
const currencySymbol = require('currency-symbol-map')
const ipc = electron.ipcRenderer;
const ipcMain = electron.ipcMain;

window.stockapi = require('./js/stockapi');


var stockMatches = []; //Global variable for stock matches
var substringMatcher = function () {
    return function findMatches(string, syncWait, cb) {
        stockapi.searchStock(string, (data) => {
            try {
                let d = (JSON.parse(data)).bestMatches;
                let results = []
                d.forEach(element => {
                    results.push(element['2. name'] + ' (' + element['1. symbol'] + ')')
                });
                window.stockMatches = results;

            } catch (error) {
                //do nothing
            }
            finally {

                cb(stockMatches);
            }
        })

    };
};


function deleteNotification(notifID) {
    let conn = db.conn;
    conn.run("DELETE FROM Notifications WHERE ID=?", notifID, (err) => {
        if (err) {
            console.log(err);
        }

    });
    loadNotifications(false);
}
function sendNotification(title, body) {
    Notification.requestPermission().then(() => {
        var myNotification = new Notification(title, {
            body: body,
            icon: '../res/Stockifier.png'
        });
    })
}
export function reloadWin() {
    electron.remote.getCurrentWindow().reload();
}

export function showNotificationWindow(ID) {
    console.log(`showNotificationWindow for ID ${ID}`);
    let options = {
        width: 650,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        },
        alwaysOnTop: true
    };
    let notifWinPath = path.join("file://", __dirname, "/notify.html")
    let notifWin = new BrowserWindow(options)
    notifWin.on('close', () => {
        notifWin = null
        reloadWin();
    })
    notifWin.loadURL(notifWinPath)

    if (ID) {
        notifWin.webContents.on('did-finish-load', () => {
            console.log(`showNotificationWindow: sending data-notify-id for ID ${ID}`);

            notifWin.webContents.send('data-notify-id', ID);
        });
    }
    notifWin.show()

}

function openNotifWin(element) {
    event.stopPropagation();
    let ID = $(element).attr('data-notify-id');
    showNotificationWindow(ID); //Passing ID to notification window

}

window.openNotifWin = openNotifWin;

export function showAnalyzeWindow() {
    let options = {
        width: 900,
        height: 650,
        webPreferences: {
            nodeIntegration: true
        },

    };
    let analyzeWinPath = path.join("file://", __dirname, "/analyze.html")
    let analyzeWin = new BrowserWindow(options)
    analyzeWin.on('close', () => analyzeWin = null)
    analyzeWin.loadURL(analyzeWinPath)
    analyzeWin.show()
}


export function showPredictWindow() {
    let options = {
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: true
        },
    };
    let predictWinPath = path.join("file://", __dirname, "/predict.html")
    let predictWin = new BrowserWindow(options)
    predictWin.on('close', () => predictWin = null)
    predictWin.loadURL(predictWinPath)
    predictWin.show()

}

/* Param: enabled 
If true then desktop chime and notification is displayed */
function loadNotifications(enabled) {
    let conn = db.conn;

    var get_notifications_qry = "SELECT Count(*) as count FROM Notifications";
    conn.get(get_notifications_qry, (err, row) => {

        $('#notificationNumber').html(row.count);
        $('#notificationCount').html(row.count);
        if (row.count > 0) {
            $('#notificationNumber').removeClass('d-none');
            if (enabled) sendNotification("Stockifier", "You have new Notifications!");
            $notifView = $('#notificationList');
            $notifView.html('');
            get_notifications_qry = "SELECT * FROM Notifications";
            conn.each(get_notifications_qry, (err, row) => {
                if (err) {
                    console.log(err);
                    return;
                }

                $notifView.append(`
                        <li class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-autohide="false">
                            <div class="toast-header d-flex">
                                <i class="material-icons">
                                    info
                                </i>
                                <strong class="mr-auto">`+ row.Title + `</strong>
                                <small class="text-muted">`+ row.Created_On + `</small>
                                <button type="button" class="ml-2 mb-1 close" data-dismiss="toast"
                                    aria-label="Close">
                                    <span onclick='deleteNotification(` + row.ID + `)'>&times;</span>
                                </button>
                            </div>
                            <div class="toast-body">
                                `+ row.Content + `
                            </div>
            
                        </li>
                        
                        `);
                $('.toast').toast('show');
            });


        }
        else {
            $('#notificationNumber').addClass('d-none');
        }

    });


}

/* Helper function for initializeAlerts() */
function checkTarget(symbol, targetVal, direction, callback) {
    stockapi.getStockQuote(symbol, (currVal) => {
        if (direction == "up") {
            if (currVal >= targetVal) {
                callback(true);
                return;
            }
        }
        else {
            if (currVal <= targetVal) {
                callback(true);
                return;
            }
        }
        callback(false);
    })
}

function initalizeAlerts() {
    let conn = db.conn;
    let i = 0;
    let notifQry = "INSERT INTO Notifications (Type,Title,Content,StockID) VALUES (?,?,?,?)";
    var direction = "falling";
    conn.each("SELECT a.ID as AlertID,a.frequency,a.direction FROM Alerts a,Stocks s WHERE a.StockID=s.ID", (err, arow) => {

        if (arow['direction'] == "up") {
            direction = "rising";
        }
        var notif = setInterval(() => {

            conn.get("SELECT a.ID as AlertID,a.*,s.* FROM Alerts a,Stocks s WHERE a.ID = " + arow['AlertID'] + " AND a.StockID=s.ID", (err, row) => {


                checkTarget(row['Index'], row['TargetPrice'], row['direction'], (beat) => {

                    if (beat) {
                        conn.run(notifQry, ['normal', "Stockifier - " + row['Index'], row['StockName'] + " beat your target value of " + row['TargetPrice'] + " while " + direction, row['StockID']], (err) => {
                            //Inserting into notification
                            console.log(err);
                        });
                        sendNotification("Stockifier - " + row['Index'], row['StockName'] + " beat your target value of " + row['TargetPrice']);
                        loadNotifications(false);
                        if (row['Auto_Renew'] == 0) {
                            // Delete Alert when notified
                            clearInterval(notif);
                            conn.run("DELETE FROM Alerts WHERE ID=?", row['AlertID'], (err) => {
                                console.log(err);
                            });
                        }
                        else {
                            if (row['direction'] == "up") {
                                conn.run("UPDATE Alerts SET TargetPrice=TargetPrice+2 WHERE ID=?", row['AlertID'], (err) => {
                                    console.log(err);
                                });
                            }
                            else {
                                conn.run("UPDATE Alerts SET TargetPrice=TargetPrice-2 WHERE ID=?", row['AlertID'], (err) => {
                                    console.log(err);
                                });
                            }
                        }
                    }

                });
            })
        }, arow['frequency'] * 60000 + i); //Frequency in minutes plus 20 seconds to avoid API timeout error
        i += 20000;
    });
}

function normalize(value, min, max) {
    return (value - min) / (max - min);
}
function loadSpotlight(element, stockID) {

    openSnackbar("Loading data...")
    var current = $('.stockSelected');
    current.removeClass('stockSelected');
    $(element).addClass('stockSelected');

    console.log(`loadSpotlight stockID ${stockID}`);

    let conn = db.conn;
    conn.get('SELECT * FROM Stocks WHERE "Index"=?', stockID, (err, row) => {
        myChart.config.options.title.text = row.StockName;
        myChart.config.options.scales.y.title.text = `Stock Price (${currencySymbol(row.Currency)})`;
    });
    stockapi.getStockData(stockID, (data) => {


        let dates = data[0];
        let time_series_points = data[1];
        let volumes = data[2];

        /* Dynamic updation of chart */
        myChart.config.data.labels = dates;
        myChart.config.data.datasets[0].data = time_series_points;
        myChart.config.data.datasets[1].data = volumes;
        myChart.config.options.scales.x.title.text = `Time (UTC) (${dates[0].split(' ')[0]})`;

        var latestPrice = time_series_points[time_series_points.length - 1];
        stockapi.getPreviousStockClose(stockID, (data) => {
            let prevClose = Array(dates.length);
            prevClose.fill(Number(data));
            console.log(prevClose);
            myChart.config.data.datasets[0].fill = true;
            if (latestPrice > prevClose[0]) {
                myChart.config.data.datasets[0].borderColor = "rgba(34, 136, 14,1)";
                myChart.config.data.datasets[0].backgroundColor = "rgba(128, 214, 111 ,0.4)";
                myChart.config.data.datasets[1].backgroundColor = "rgba(20, 80, 8 ,0.8)";

            }
            else {
                myChart.config.data.datasets[0].borderColor = "rgba(222, 16, 16,1)";
                myChart.config.data.datasets[0].backgroundColor = "rgba(222, 16, 16,0.4)";
                myChart.config.data.datasets[1].backgroundColor = "rgba(106, 21, 11,0.8)";
            }

            myChart.config.data.datasets[2].data = prevClose;
            myChart.update();
        });

    });

}
window.loadSpotlight = loadSpotlight;

/* Initialize Spotlight chart */
var ctx = $("#myChart");
var myChart = new Chart(ctx, {
    type: 'bar',
    data: {
        type: 'bar',
        datasets: [{
            type: 'line',
            label: 'Stock Price',
            data: [],
            fill: false,
            borderWidth: 2,
            borderColor: 'rgba(196, 22, 98,1)',
            backgroundColor: 'rgba(196, 22, 98,1)',
            pointRadius: 1,
            yAxisID: 'price'
        }, {
            type: 'bar',
            label: 'Volume',
            fill: false,
            data: [],
            backgroundColor: 'rgba(190, 135, 211,0.8)',
            yAxisID: 'volume'
        }, {
            type: 'line',
            label: 'Previous Close',
            fill: false,
            data: [],
            borderColor: 'rgb(53, 16, 84)',
            backgroundColor: 'rgba(53, 16, 84,0.2)',
            borderDash: [10, 8],
            pointRadius: 0,
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        title: {
            display: true,
            text: 'Select a Stock to view performance'
        },
        scales: {
            xAxes: [{
                gridLines: {
                    display: false
                },
                type: 'time',
                scaleLabel: {
                    display: true,
                    labelString: "Time (UTC)"
                }
            }],
            yAxes: [{
                type: 'linear',
                position: 'left',
                id: 'price',
                gridLines: {
                    display: false
                },
                scaleLabel: {
                    display: true,
                    labelString: "Stock Price"
                }
            }, {
                type: 'linear',
                position: 'right',
                id: 'volume',
                gridLines: {
                    display: false
                }
            }]
        }
    }
});

/* Timely updation of stock database prices - High and Low */
function updateStocks() {
    let conn = db.conn;
    let t = 20000;
    conn.each('SELECT ID,"Index" FROM Stocks', (err, row) => {
        setTimeout(() => {
            stockapi.getStockUpdates(row.Index, (data) => {
                data = data['Global Quote'];

                conn.run("UPDATE Stocks SET High=" + data['03. high'] + ", Low=" + data['04. low'] + " WHERE ID=?", row.ID);
            });

        }, t);
        t += 20000;
    });
}



const sb = mdc.snackbar.MDCSnackbar.attachTo(document.querySelector('.mdc-snackbar'));
function openSnackbar(snackbarMsg) {
    var snackbar = $("#snackbar-msg");
    snackbar.text(snackbarMsg);
    sb.open();
}
window.openSnackbar = openSnackbar;

/* Resize spotlight chart after window resize */
$("#menu-toggle").click(function (e) {
    e.preventDefault();
    setTimeout(() => {
        myChart.resize();
    }, 1000);
    $("#wrapper").toggleClass("toggled");
});



$(document).ready(function () {

    $('.dropdown-menu').click(function (e) {
        e.stopPropagation();
    });
    /* Add stock button */
    $('#btnAddStock').on('click', () => {

        $('.dropdown').dropdown("toggle");
        var stockName = $('#typeahead').val();
        let conn = db.initDB();
        if (stockName.includes('(') && stockName.includes(')')) {
            var stIndex = stockName.split('(')[1];
            stIndex = stIndex.split(')')[0];
            stockName = stockName.split('(')[0];
            stockName = stockName.split(' ').splice(0, 1).join(" ");
            console.log(`searching for name ${stockName} with ${stIndex}`);

            stockapi.searchStock(stockName, (data) => {
                console.log(`search stock ${stockName} response: ${data}`);
                try {
                    data = JSON.parse(data).bestMatches;

                } catch (error) {
                    console.log(`An error occured while parsing json: ${error}`);
                    openSnackbar("An error occured while parsing json, " + error);
                    return;
                }

                for (let index = 0; index < data.length; index++) {
                    const element = data[index];

                    if (element['1. symbol'] == stIndex) {

                        var insertStockQry = "INSERT INTO Stocks ('Stockname','Index','High','Low','Currency') VALUES ('" + element['2. name'] + "','" + stIndex + "',0,0,'" + element['8. currency'] + "')";

                        conn.run(insertStockQry, (err) => {
                            if (err) console.log(err);
                            $('#typeahead').val('');
                            openSnackbar("Stock Added!");
                            initializeStockView();

                        });
                        break;
                    }
                }

            });
        }
        else {
            try {
                stockName = stockName.split(' ').splice(0, 1).join(" ");
                console.log(`searching for name ${stockName}`);

                stockapi.searchStock(stockName, (data) => {
                    console.log(`search stock ${stockName} response: ${data}`);

                    try {
                        var bestMatches = [];
                        var parsedData = JSON.parse(data);
                        if (parsedData.notes) {
                            openSnackbar(`Message from source: ${parsedData.notes}`);
                        } else {
                            bestMatches = parsedData.bestMatches;
                        }
                    } catch (error) {
                        console.log(`An error occured while parsing json: ${error}`);
                        openSnackbar("An error occured while parsing json, " + error);
                        return;
                    }
                    if (bestMatches.length === 0) {
                        openSnackbar(`No stock found with name: ${stockName}`);
                    } else {
                    // eigenlijk wil je hieruit kunnen kiezen
                    var stockData = bestMatches[0];

                        var insertStockQry = "INSERT INTO Stocks ('Stockname','Index','High','Low','Currency') VALUES ('" + stockData['2. name'] + "','" + stockData['1. symbol'] + "',0,0,'" + stockData['8. currency'] + "')";
                        console.log(`insertStockQry ${insertStockQry}`);
                        conn.run(insertStockQry, (err) => {
                            if (err) console.log(err);
                            $('#typeahead').val('');
                            openSnackbar("Stock Added!");
                            initializeStockView();
    
                        });
                    }
                });
            } catch (error) {
                alert("An error occured!" + error);
            }
        }


    });

    /* Typeahead instance */
    $('#the-basics .typeahead').typeahead(
        {
            hint: true,
            highlight: true,
            minLength: 3

        },
        {
            name: 'stocks',
            source: substringMatcher()
        });

    /* Initialize ripple for all buttons and textfields*/
    const ripples = document.querySelectorAll('.mdc-ripple-surface');
    for (const ripple of ripples) {
        mdc.ripple.MDCRipple.attachTo(ripple);
    }
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        mdc.ripple.MDCRipple.attachTo(button);
    }
    const textfields = document.querySelectorAll('.mdc-text-field');
    for (const tf of textfields) {
        mdc.textField.MDCTextField.attachTo(tf);
    }


    /* Alert Dialog */
    const dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('.mdc-dialog-deletediag'));

    function openDeleteDialog(dialogTitle, dialogMessage, deleteID) {
        var dialogTitleElement = $("#my-dialog-title");
        var dialogmsg = $('#my-dialog-content');
        dialogTitleElement.text(dialogTitle);
        dialogmsg.text(dialogMessage);
        dialog.open();

        dialog.listen('MDCDialog:closing', (action) => {
            let actionSel = action.detail.action;
            let conn = db.conn;
            if (actionSel == "yes") {
                let delStockQry = "DELETE FROM Stocks WHERE ID=?";
                conn.run(delStockQry, deleteID, (err) => {
                    if (err) {
                        return openSnackbar("Unable to delete!");
                    }
                    conn.run("DELETE FROM Alerts WHERE StockID=?", deleteID);
                    openSnackbar("Deleted successfully!");
                    initializeStockView();
                });
            }
        })
    }
    /* Function to handle stockDelete */
    $(document).on('click', ".btnDeleteStock", function (event) {
        event.stopImmediatePropagation();
        openDeleteDialog("Delete Stock", "Are you sure you want to delete the stock?", $(this).attr('data-delete-id'));
    });

    $(document).on('click', "#showNotificationWindow", showNotificationWindow);
    $(document).on('click', "#showAnalyzeWindow", showAnalyzeWindow);
    $(document).on('click', "#showPredictWindow", showPredictWindow);

    /* Initialize stocks view */
    function initializeStockView() {
        let conn = db.initDB();
        console.log(conn);
        var stocksList = $('#myStocks');
        stocksList.html('');
        conn.get("SELECT COUNT(*) as count FROM Stocks", (err, row) => {
            if (row.count > 0) {
                conn.each("SELECT ID,\"Index\",StockName,High,Low,Currency FROM Stocks", function (err, row) {
                    stocksList.append(`
                                <li id="loadSpotlight"
                                    class="list-group-item list-group-item-action justify-content-center align-items-center" onclick='loadSpotlight(this,"`+ row.Index + `")'>
                                    <div class="mr-auto p-2" id="stockTitle"><b>`+ row.Index + `</b>
                                        <div class="badge badge-success badge-pill p-2 float-right">High: `+ currencySymbol(row.Currency) + row.High + `</div>
                                        <br>
                                        <span id="stockTitle">`+ row.StockName + `</span>
                                    </div>
                                    <div class="p-2 d-flex justify-content-around">
                                        <button class="mdc-fab mdc-fab--mini mdc-fab--extended notify" data-notify-id=`+ row.ID + ` onclick='openNotifWin(this);'>
                                            <span class="mdc-fab__icon material-icons">notifications_active</span>
                                            <span class="mdc-fab__label">Notify</span>
                                        </button>
                                        <button class="mdc-fab mdc-fab--mini delete mdc-fab--extended btnDeleteStock"
                                            data-delete-id=`+ row.ID + `>
                                            <span class="mdc-fab__icon material-icons">delete</span>
                                            <span class="mdc-fab__label">Delete</span>

                                        </button>
                                    </div>
                                </li>
                    `);
                });
            }
            else {
                stocksList.html(`
            
                    <li class="list-group-item justify-content-center align-items-center">
                        No stocks found!
                    </li>
                    `);
            }
        })

    }

    /* Initializing all components */
    updateStocks();
    initializeStockView();
    loadNotifications(true);
    initalizeAlerts();

    $("#txtStockSearch").on("keyup", function () {
        var stockName = $(this).val().toLowerCase();

        $("#myStocks li").filter(function () {
            $(this).toggle($(this).text().toLowerCase().indexOf(stockName) > -1)
        });
    });
});
