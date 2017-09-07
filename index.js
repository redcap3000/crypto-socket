/*
    Crypto-socket

    A basic wrapper for websockets, along with pusher and autobahn for the exchanges that use them.
    Most exchanges (that use normal websockets) are passed through 'makeSocket'. Which updates 
    global variable 'Exchanges' which can be accssessd via .getQuote('btcusd','bitfinex').
    Values wont appear until the socket returns the something. Most of the exchanges send back
    a fair amount of data other than a simple last trade price but that is the only information
    currently stored.
*/

var WebSocket = require('faye-websocket'),
    Pusher = require('pusher-client'),
    autobahn = require('autobahn'),
    bittrex = require('node.bittrex.api');

var Exchanges = {},
    Sockets = {},

    BfxChannelIds = {};

exports.Exchanges = Exchanges;
/* Eventually get this information from some kind of endpoint
    that can be requested on demand and potentially stored
    ... somewhere ?
    Also to note, theres no btcSym because (for now)
    can just convert it as normal. But some symbol names
    are different across exchanges (BCC/BCH)
    Once this is replicated across the other exchanges
    only this variable will need to be changed to support any market.
*/

ExchangeInfo = {
    'bittrex': {
        'USD': [
            'BTC', 'ETH', 'NEO',
            'LTC', 'BCC', 'ETC',
            'ZEC', 'XMR', 'DASH',
            'XRP'
        ],
        'ETH': [
            'OMG', 'NEO', 'QTUM',
            'PAY', 'BCC', 'LTC',
            'SNT', 'XRP', 'CVC',
            'ADX', 'ETC', 'GNT',
            'STRAT', 'ZEC', 'BAT',
            'TKN', 'XMR', 'MTL',
            'FUN'
        ]
    },
    // bifinex calls BCC bcash?
    // not supporting chain split tokens
    // because they're BCC .... its confusing af
    'bitfinex': {
        'USD': [
            'BTC', 'LTC', 'ETH',
            'ETC', 'RTT', 'ZEC',
            'XMR', 'DASH', 'IOTA',
            'EOS', 'SAN', 'OMG',
            'BCC'
        ],
        'ETH': [
            'IOTA', 'EOS', 'SAN', 'OMG',
            'BCC'
        ]
    }
};

// helper function that can simply echo the exchanges variable so its kinda like a ticker.
exports.echoExchange = function() {
    console.log("\n\n\n\n\n\n\n\n\n\n");
    for (k in Exchanges) {
        console.log('\t' + k);
        var r = '';
        for (s in Exchanges[k]) {
            r += s + '\t' + Exchanges[k][s] + '\t';
        }
        console.log(r);
    }
    //console.log(Exchanges);
};
exports.start = function(exchange, symbols) {
    if (typeof exchange == "undefined") {
        cryptoSockets.start();
    } else {
        // check if its supported... ?
        cryptoSockets.start(exchange, symbols);
    }
};


// bread and butter for 2/3 of exchanges. url is the websocket endpoint, title refers to the exchange (single word),onMessage
// is a function that runs when the socket receives a message, send is an object that is sent to subscribe where applicable
var supportedExchanges = [
    'bittrex',
    'bitfinex',
    'bitmex',
    'bitstamp',
    'cex',
    'gdax',
    'gemini',
    'okcoin',
    'poloniex'
];
var getExchangeSymbols = function(exchange) {
    return ExchangeInfo[exchange]
}
var assembleSymbols = function(exchange) {
    supportedSymbols = []
    for (var key in ExchangeInfo[exchange]) {
        ExchangeInfo[exchange][key].filter(function(main) {
            var symbol = ''
            var sub = ''
            if (exchange == 'bitfinex' && key == 'BCC') {
                sub = BCC
            } else {
                sub = key
            }

            if (main != "BTC") {
                symbol = main + sub
            } else {
                symbol = sub + main
            }
            supportedSymbols.push(symbol)
        })

    }
    return supportedSymbols
}
exports.supportedExchanges = supportedExchanges;

var cryptoSockets = {

    'bittrex': function(symbols) {
        console.log(symbols)
        if (typeof symbols == 'undefined') {
            // default it
            symbols = ['BTCUSD']
        }
        var activeBittrexSymbols = assembleSymbols('bittrex')

        function convertSymbol(sym) {
            // check for used
            var pairs = ['BTC', 'USD', 'ETH'];
            if (sym == 'BTCUSD') {
                return 'USDT-BTC';
            } else {
                var symbol = ''
                pairs.filter(function(p) {
                    console.log(p)
                    if (sym.endsWith(p) && symbol == '') {
                        symbol = p + (p == 'USD' ? 'T' : '') + '-' + sym.split(p)[0];
                    }
                })

            }
            if (typeof symbol != 'undefined' && symbol != '') {
                return symbol;
            } else {
                console.log("Could not convert bittrex symbol, market not found.")
            }
        }
        if (typeof Exchanges['bittrex'] == "undefined") {
            Exchanges['bittrex'] = {};
        }
        if (typeof symbols != 'undefined') {
            // check exchanges to see that quote is not 
            // already reporting
            // this mostly handles appropriate referen
            var listening = [];
            symbols.filter(function(sym) {
                if (parseInt(activeBittrexSymbols.indexOf(sym)) > -1) {
                    //    console.log('already listening ' + sym);
                    activeBittrexSymbols.push(sym)
                }
                var relation = convertSymbol(sym);
                //console.log( 'listen for ' + relation);
                // not a web socket poll/diff :(
                bittrex.getticker({ market: relation, stream: true }, function(response) {
                    var responseObj = response.result
                    // cant believe this crap. the only way to avoid 'null' errors
                    // if market was invalid etc.
                    if (typeof responseObj != 'undefined' && responseObj != null && responseObj && typeof responseObj.Last == 'number') {
                        Exchanges.bittrex[sym] = parseFloat(responseObj.Last);

                    }
                    //}
                });
                //}
            });
            // unlisten to variables that aren't present?
            // to do add all open 'getTicker' sockets to another variable so they can be closed
            /*
            for(var key in Exchanges['bittrex']){
                if(parseInt(listening.indexOf(key)) == -1){
                    // unlisten to this quote somehow
                }
            }*/
            return true;
        }
    },
    'bitfinex': function(symbols) {
        console.log("bitfinex start")
        // walk through exchange info to build list of supported symbols
        var activeSymbols = []
        var supportedSymbols = ['BTCUSD']
        for (var key in ExchangeInfo.bitfinex) {
            ExchangeInfo.bitfinex[key].filter(function(main) {
                var symbol = ''
                var sub = ''
                if (key == 'BCC') {
                    sub = BCC
                } else {
                    sub = key
                }
                if (main != "BTC") {
                    symbol = main + sub
                } else {
                    symbol = sub + main
                }
                supportedSymbols.push(symbol)
            })
          
        }
        if (typeof symbols == 'undefined') {
            activeSymbols.push({
                "event": "subscribe",
                "channel": "ticker",
                "pair": 'BTCUSD'
            })
        } else {
            if (symbols == 'string') {
                if (parseInt(supportedSymbols.indexOf(symbols)) > -1) {
                    activeSymbols.push({
                        "event": "subscribe",
                        "channel": "ticker",
                        "pair": symbols
                    })
                }
            } else if (symbols.length > 0) {
                symbols.filter(function(s) {
                    console.log(s)
                        if (parseInt(supportedSymbols.indexOf(s)) > -1) {
                            activeSymbols.push({
                                "event": "subscribe",
                                "channel": "ticker",
                                "pair": s
                            })
                        }           
                    }
                )
            }
        }
        // probably had to make this self because of the filter function
        var fmakeSocket = this.makeSocket
        activeSymbols.filter(function(sym){
        // should add symbol name to 'title' for 'close' reference
        // but causes issue with 'tickerCode on line 285'
        fmakeSocket('wss://api2.bitfinex.com:3000/ws', 'bitfinex', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (typeof data.event != "undefined" && data.event == "subscribed" || data.event == "info") {
                    if (data.event == "subscribed" && typeof data.chanId != "undefined" && typeof data.pair != "undefined") {
                        // match channel id with pair
                        BfxChannelIds[data.chanId + ''] = data.pair;
                    }
                }
                if (typeof data[1] != "undefined" && data[1] != "hb") {
                    var floatCheck = parseFloat(data[7]);
                    if (floatCheck && floatCheck > 0) {
                        var tickerValue = floatCheck;
                    }
                    if (tickerValue) {
                        if (tickerValue < 2) {
                            // this is ETH
                            var tickerCode = 'ETHBTC';
                        } else {
                            var tickerCode = "BTCUSD";
                        }
                        //force string
                        var tickerCode = BfxChannelIds[data[0] + ''];

                        if (tickerCode && tickerValue != Exchanges.bitfinex[tickerCode]) {
                            Exchanges.bitfinex[tickerCode] = tickerValue;
                        }
                    }
                }
            }
        }, sym);
        })
        return true;
    },
    'bitmex': function(symbol) {
        console.log("starting bitmex");
        // to support more bitmex symbols check out their rest API and implement symbols you see from
        // the return of their endpoints
        var symbols = {
            ".ETHXBT": "ETHBTC",
            "XBTUSD": 'BTCUSD',
            ".LTCXBT": "LTCBTC"
        }
        var query = Object.keys(symbols)
            .filter((key) => {
                if (symbol) {
                    return symbols[key] == symbol
                } else {
                    return true
                }
            })
            .map((symbol) => { return 'trade:' + symbol })
            .join(',')
        this.makeSocket('wss://www.bitmex.com/realtime?subscribe=' + query, 'bitmex', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && data.data) {
                    data = data.data[0];
                    if (typeof data == "undefined" || typeof data.symbol == "undefined") {
                        // some responses are blank or notification of sub.. when that happens this crashes... 
                        return false;
                    }
                    if (symbols[data.symbol]) {
                        Exchanges.bitmex[symbols[data.symbol]] = parseFloat(data.price)
                    }
                } else {
                    //console.log(event);
                    console.log(JSON.parse(event.data));
                    console.log("Issue with bitmex response");
                    // close the socket?
                }
            }
        });
        return true;
    },
    'bitstamp': function(symbol) {
        if (typeof Pusher != "undefined") {
            try {
                var pusher = new Pusher('de504dc5763aeef9ff52', {});
                if (typeof Exchanges.bitstamp == "undefined") {
                    Exchanges.bitstamp = {};
                }
            } catch (error) {
                console.log("startBitstampSocket error:\t:**");
                console.log(error);
                return false;
            }
            console.log("starting bistamp socket");
            if (typeof symbol == "undefined") {
                // dont forget to filter to only data u want.
                BitstampSocket = pusher.subscribe('live_trades');
                var i = 0;
                BitstampSocket.bind('trade', function(data) {
                    var price = parseFloat(data['price']);
                    if (Exchanges.bitstamp.BTCUSD != price) {
                        Exchanges.bitstamp.BTCUSD = parseFloat(data['price']);
                    }
                });
                BitstampSocket2 = pusher.subscribe('live_trades_xrpbtc');
                var i = 0;
                BitstampSocket2.bind('trade', function(data) {
                    var price = parseFloat(data['price']);
                    if (Exchanges.bitstamp.XRPBTC != price) {
                        Exchanges.bitstamp.XRPBTC = parseFloat(data['price']);
                    }
                });
            } else {
                // check supported symbol pairs
                var symbolConversion = {
                    'XRPBTC': 'live_trades_xrpbtc'
                }
            }
            return true;
        } else {
            console.log("No pusher");
            return false;
        }
    },
    'cex': function(symbol) {
        this.makeSocket('wss://ws.cex.io/ws/', 'cex', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && typeof data.data != "undefined") {
                    data = data.data;
                    var tickerValue = parseFloat(data.price);
                    if ((data.symbol1 == 'BTC' && data.symbol2 == 'USD') || (data.symbol1 == 'ETH' && data.symbol2 == 'BTC')) {
                        var tickerCode = data.symbol1 + data.symbol2;
                        if (typeof symbol == "string" && tickerCode != symbol) {
                            return false;
                        }
                        if (tickerValue != Exchanges.cex[tickerCode]) {
                            Exchanges.cex[tickerCode] = tickerValue;
                        }
                    }
                }
            }
        }, {
            "e": "subscribe",
            "rooms": [
                "tickers"
            ]
        });
        return true;
    },
    'gdax': function(symbol) {
        var norm = (symbol) => { return symbol.replace('-', '') }
        var query = [{
                "type": "subscribe",
                "product_id": "BTC-USD"
            }, {
                "type": "subscribe",
                "product_id": "ETH-BTC"
            },
            {
                "type": "subscribe",
                "product_id": "LTC-BTC"
            }
        ].filter((item) => {
            return typeof symbol == 'undefined' || norm(item.product_id) == symbol
        });
        this.makeSocket('wss://ws-feed.gdax.com/', 'gdax', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && typeof data.type != "undefined") {
                    var tickerValue = parseFloat(data.price);
                    if (tickerValue != Exchanges.gdax[norm(data.product_id)]) {
                        Exchanges.gdax[norm(data.product_id)] = tickerValue
                    }
                }
            }
        }, query)
    },
    'gemini': function(symbol) {
        if (typeof symbol != "undefined" && symbol == 'ETHBTC') {;
        } else {
            this.makeSocket('wss://api.gemini.com/v1/marketdata/btcusd', 'gemini', function(event) {
                if (typeof event.data != "undefined") {
                    var data = JSON.parse(event.data);
                    if (data && typeof data.events != "undefined") {
                        data = data.events[0];
                        if (data.type == "trade") {
                            if (typeof Exchanges.gemini == "undefined") {
                                Exchanges.gemini = {};
                            }
                            var tickerValue = parseFloat(data.price);
                            Exchanges.gemini["BTCUSD"] = tickerValue;

                        }
                    }
                }
            });
        }
        this.makeSocket('wss://api.gemini.com/v1/marketdata/ethbtc', 'gemini2', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && typeof data.events != "undefined") {
                    data = data.events[0];
                    if (data.type == "trade") {
                        var tickerValue = parseFloat(data.price);
                        if (typeof Exchanges.gemini == "undefined") {
                            Exchanges.gemini = {};
                        }
                        Exchanges.gemini["ETHBTC"] = tickerValue;

                    }
                }
            }
        });
        return true;
    },
    'okcoin': function(symbol) {
        var query = [{
                "event": "addChannel",
                "channel": "ok_btcusd_ticker",
                "pair": "BTCUSD"
                //"prec" : "P0"
            }, {
                "event": "addChannel",
                "channel": "ok_ltcusd_ticker",
                "pair": "LTCUSD"
            },
            {
                "event": "addChannel",
                "channel": "ok_ethusd_ticker",
                "pair": "ETHUSD"
                //"prec" : "P0"
            }
        ];

        if (typeof symbol == "string" && symbol == "LTCUSD") {
            query.shift();
        } else if (typeof symbol == "string" && symbol == "BTCUSD") {
            query.pop();
        }
        console.log("Start okcSocket");
        this.makeSocket('wss://real.okcoin.com:10440/websocket/okcoinapi', 'okcoin', function(event) {
            var data = JSON.parse(event.data);
            if (data) {
                data = data[0];
            } else {
                console.log(event);
                console.log("Issue with server response");
            }
            if (typeof data.data == "undefined") {
                // nothing to process
                return false;
            }
            if (typeof data != "undefined" && typeof data.channel != "undefined") {
                if (data.channel == "ok_ltcusd_ticker") {
                    var tickerCode = "LTCUSD";
                } else if (data.channel == "ok_btcusd_ticker") {
                    var tickerCode = "BTCUSD";
                }
                data = data.data.last;
                var floatCheck = parseFloat(data);
                if (floatCheck && floatCheck > 0) {
                    var tickerValue = floatCheck;
                }
                if (tickerValue) {
                    if (tickerValue != Exchanges.okcoin[tickerCode]) {
                        Exchanges.okcoin[tickerCode] = tickerValue;
                    }
                }
            }
        }, query);

        return true;

    },
    'poloniex': function(symbol) {
        var wsuri = "wss://api.poloniex.com";
        Sockets.poloniex = new autobahn.Connection({
            url: wsuri,
            realm: "realm1"
        });
        if (typeof Exchanges.poloniex == "undefined") {
            Exchanges.poloniex = {};
        }
        try {
            Sockets.poloniex.onopen = function(session) {
                session.subscribe('ticker', function(args, kwargs) {
                    var codeConversion = {
                        "BTC_ETH": "ETHBTC",
                        "USDT_BTC": "BTCUSD",
                        "USDT_LTC": "LTCUSD",
                        "USDT_XRP": "XRPUSD",
                        "USDT_DASH": "DASHUSD",
                        'USDT_XMR': "XMRUSD",
                        'USDT_ZEC': "ZECUSD",
                        "USDT_NXT": "NXTUSD",
                        "BTC_LTC": "LTCBTC",
                        "BTC_DASH": "DASHBTC",
                        "USDT_ETH": "ETHUSD",
                        "BTC_POT": "POTBTC",
                        "BTC_XMR": "XMRBTC",
                        "BTC_DOGE": "DOGEBTC",
                        "BTC_ZEC": "ZECBTC",
                        "BTC_XLM": "XLMBTC",
                        "BTC_ETC": "ETCBTC",
                        "BTC_MAID": "MAIDBTC",
                        "BTC_XEM": "XEMBTC",
                        "BTC_BTS": "BTSBTC",
                        "BTC_BCH": "BCHBTC",
                        "USDT_BCH": "BCHUSD",
                        "BTC_XRP": "XRPBTC"
                    }
                    var tickerCode = (typeof codeConversion[args[0]] != "undefined" ? codeConversion[args[0]] : false);

                    if ((tickerCode != symbol && typeof symbol != "undefined") || !tickerCode) {
                        return false;
                    }
                    tickerValue = parseFloat(args[1]);

                    if (Exchanges.poloniex[tickerCode] != tickerValue) {
                        Exchanges.poloniex[tickerCode] = tickerValue;
                    }
                });
            };
        } catch (error) {
            console.log(error);
        }

        Sockets.poloniex.onclose = function() {
            console.log("Polosocket connection closed");
        }
        Sockets.poloniex.open();
    },
    makeSocket: function(url, title, onMessage, send) {
        if (typeof url != "string" || typeof title != "string") {
            return false;
        }
        if (typeof Sockets[title] == "undefined" || !Sockets[title]) {
            Sockets[title] = {};
        }
        Sockets[title] = new WebSocket.Client(url);

        try {
            Sockets[title].on('open', function(event) {
                console.log(title + ' open');
                if (typeof Exchanges[title] == "undefined" && title != "gemini2") {
                    Exchanges[title] = {};
                }
            })
        } catch (error) {
            console.log(error);
            return false;

        }
        try {
            Sockets[title].on('close', function(event) {
                console.log(title + ' close');
            })
        } catch (error) {
            console.log(error);
            return false;
        }
        if (typeof onMessage == "function") {
            Sockets[title].on('message', onMessage);
        }
        if (typeof send == "object" && !send instanceof Array) {
            // parse an object to send ?
            try {
                Sockets[title].send(JSON.stringify(send));
            } catch (error) {
                console.log(error);
                return false;
            }
        } else if (typeof send != "undefined" && send instanceof Array) {
            send.filter(function(o) {
                Sockets[title].send(JSON.stringify(o));
            });
        } else if (typeof send != "undefined") {
            try {
                Sockets[title].send(JSON.stringify(send));
            } catch (error) {
                console.log(error);
                return false;
            }
        }
        return true;
    },
    'start': function(exchange, symbols) {
        if (typeof exchange == "undefined") {
            var self = this;

            supportedExchanges.filter(function(e) {
                console.log(e);
                self[e](symbols);
            });
        } else {
            try {
                this[exchange](symbols);
            } catch (error) {
                console.log(exchange);
                console.log(error);
            }
        }
    },
    'stop': function(socket) {
        // only for the faye socket libraries?
        if (typeof Sockets[socket] != "undefined") {
            Sockets[socket].close();
            return true;
        }
        return false;
    }

};
// idea make into object that can take a start constructor with options ... and returns an object with the getQuote method.