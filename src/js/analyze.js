const db = require('./js/database');
const stockapi = require('./js/stockapi')
const currencySymbol = require('currency-symbol-map')
const Chart = require('/media/andre/Data/git/repo/Stockifier/node_modules/chart.js/dist/chart.umd')
const electron = require('electron');

function getStocks() {
    // was globale variabele
    let stocks = $('#stocksList');
    let conn = db.conn;

    conn.each('SELECT ID,"Index",StockName FROM Stocks', (err, row) => {
        if (err) {
            console.log(err);
        } else {
            stocks.append(`
                <option value="`+ row['Index'] + `">` + row.StockName + ` - ` + row.Index + `</option>
            `);
        }
    });
}

function updatePriceChart(interval) {

    console.log(`updatePriceChart interval: ${interval}`);
    let stockID = $('#stocksList').val();
    console.log(`updatePriceChart stockID: ${stockID}`);
    let conn = db.conn;
    conn.get('SELECT * FROM Stocks WHERE "Index"=?', stockID, (err, row) => {
        priceChart.config.options.title.text = row.StockName;
        let cs = currencySymbol(row.Currency);

        priceChart.config.options.scales.price.title.display = true;
        priceChart.config.options.scales.price.title.text = `Stock Price (${cs})`;
        priceChart.update();
    });

    stockapi.getStockPrices(stockID, interval, (data) => {

        let time_series_points = data[0];
        let volumes = data[1];
        let dates = data[2];

        let merged_t = [];
        let merged_v = []
        for (let index = 0; index < dates.length; index++) {
            merged_t.push({ x: dates[index], y: time_series_points[index] });
            merged_v.push({ x: dates[index], y: volumes[index] })
        }
        /* Dynamic updation of chart */
        //priceChart.data.labels = dates;
        priceChart.data.datasets[0].data = merged_t
        priceChart.data.datasets[1].data = merged_v;
        if (interval == "max") {
            priceChart.data.datasets[0].pointRadius = 0;
        }
        else {
            priceChart.data.datasets[0].pointRadius = 3;
        }
        priceChart.update();

    });
}

var ctx = $('#priceChart')
var priceChart = new Chart(ctx, {
    type: 'bar',
    data: {
        type: 'bar',
        datasets: [{
            type: 'line',
            label: 'Stock Price',
            fill: false,
            data: [],
            borderWidth: 2,
            borderColor: 'rgba(196, 22, 98,1)',
            backgroundColor: 'rgba(196, 22, 98,1)',
            pointRadius: 3,
            yAxisID: 'price'
        }, {
            type: 'bar',
            label: 'Volume',
            fill: false,
            data: [],
            backgroundColor: 'rgba(190, 135, 211,0.4)',
            yAxisID: 'volume'
        }]
    },
    config: {
        options: {
            title: 'Select a Stock to view performance',
            scales: {
                volumes: {
                    title: {
                        text: 'Time'
                    }
                },
                price: {
                    title: {
                        text: 'Stock Price'
                    }
                },
            }
        }
    },
    options: {
        responsive: true,
        title: {
            display: true,
            text: 'Select a Stock to view performance'
        },
        scales: {
            xAxes: [{
                display: true,
                gridLines: {
                    display: false
                },
                distribution: 'series',
                type: 'time',
                scaleLabel: {
                    display: true,
                    labelString: "Time"
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

function updateIndicatorChart(element) {
    element = $('#indicatorsList');
    // was globale variabele
    let stockIndicator = $(element).val();
    let stockID = $('#stocksList').val();
    let conn = db.conn;
    conn.get('SELECT * FROM Stocks WHERE "Index"=?', stockID, (err, row) => {
        if (err) {
            console.error(`updateIndicatorChart, conn.get err ${err}`);
        }
        // indicatorChart.config.options.scales.y.title.text = row.StockName;
    });

    stockapi.getStockIndicator(stockID, stockIndicator, (data) => {
        console.log(`getStockIndicator callback data: ${data}`);
        let indicator = data[0];
        let dates = data[1];

        var merged_t = [];
        for (let index = 0; index < dates.length; index++) {
            merged_t.push({ x: dates[index], y: indicator[index] });
        }
        console.log(stockIndicator);
        if (stockIndicator == "RSI") {
            indicatorChart.options.scales.yAxes[0].beginAtZero = true;
            indicatorChart.options.scales.yAxes[0].max = 100;
        }
        indicatorChart.data.datasets[0].label = "Stock Indicator - " + stockIndicator;
        indicatorChart.data.datasets[0].data = merged_t;
        indicatorChart.update();
    });

}
/* Indicator Chart */

var ctx = $('#indicatorChart')
var indicatorChart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [{
            type: 'line',
            label: 'Stock Indicator',
            fill: false,
            data: [],
            borderWidth: 2,
            borderColor: 'rgba(196, 22, 98,1)',
            backgroundColor: 'rgba(196, 22, 98,1)',
            pointRadius: 3,
        }]
    },
    options: {
        responsive: true,
        title: {
            display: true,
            text: 'Select a Stock and Indicator to view characterstics'
        },
        scales: {
            xAxes: [{
                display: true,
                gridLines: {
                    display: false
                },
                distribution: 'series',
                type: 'time'
            }],
            yAxes: [{
                type: 'linear',
                gridLines: {
                    display: false
                }
            }]
        }
    }
});

function updateSelected(element) {
    // was globale variabele
    var current = $('.selectedInterval');
    current.removeClass('selectedInterval')
    $(element).addClass('selectedInterval');
}

$(document).ready(function () {
    getStocks();
});

$(document).on('change', "#indicatorsList", function() {updateIndicatorChart(this)});
$(document).on('click', "#stocksList", function(event) {
    updatePriceChart('min');
    updateSelected($('#btnSelectMin'));
});
$(document).on('click', "#maxTimeRange", function(event) {
    updatePriceChart('max');
    updateSelected(this);
});
$(document).on('click', "#month6TimeRange", function(event) {
    updatePriceChart('6months');
    updateSelected(this);
});
$(document).on('click', "#monthTimeRange", function(event) {
    updatePriceChart('month');
    updateSelected(this);
});
$(document).on('click', "#weekTimeRange", function(event) {
    updatePriceChart('week');
    updateSelected(this);
});
$(document).on('click', "#btnSelectMin", function(event) {
    updatePriceChart('min');
    updateSelected(this);
});

const sb = mdc.snackbar.MDCSnackbar.attachTo(document.querySelector('.mdc-snackbar'));

function openSnackbar(snackbarMsg) {
    // was globale variabele
    var snackbar = $("#snackbar-msg");
    snackbar.text(snackbarMsg);
    sb.open();
    setTimeout(() => {
        sb.close()
    }, 5000);

}

const textfields = document.querySelectorAll('.mdc-text-field');

for (const tf of textfields) {
    mdc.textField.MDCTextField.attachTo(tf);
}

const buttons = document.querySelectorAll('button');

for (const button of buttons) {
    mdc.ripple.MDCRipple.attachTo(button);
}

const select = document.querySelectorAll('.mdc-select');

for (const s of select) {
    mdc.select.MDCSelect.attachTo(s);
}