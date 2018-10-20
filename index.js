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
    bittrex = require('node.bittrex.api')
;
     
var Exchanges = {}, Sockets = {},

BfxChannelIds = {};

exports.Exchanges = Exchanges;

// helper function that can simply echo the exchanges variable so its kinda like a ticker.
exports.echoExchange = function() {
    console.log("\n\n\n\n\n\n\n\n\n\n");
    for(k in Exchanges){
        console.log('\t'+k);
        var r = '';
        for(s in Exchanges[k]){
            r += s + '\t' + Exchanges[k][s] + '\t';
        }
        console.log(r);
    }
    //console.log(Exchanges);
};
exports.start = function(exchange,symbols) {    
    if(typeof exchange == "undefined"){
        cryptoSockets.start();
    }else{
        // check if its supported... ?
        cryptoSockets.start(exchange,symbols);
    }
};
// bread and butter for 2/3 of exchanges. url is the websocket endpoint, title refers to the exchange (single word),onMessage
// is a function that runs when the socket receives a message, send is an object that is sent to subscribe where applicable
var supportedExchanges = [
    'poloniex',
    'bittrex',
    'bitfinex',
    'bitmex',
    'bitstamp',
    'cex',
    'gdax',
    'gemini'
];

exports.supportedExchanges = supportedExchanges;

var cryptoSockets = {
    'bittrex' : function(){
        console.log("BITTREX START")
        if(typeof Exchanges['bittrex'] == "undefined"){
            Exchanges['bittrex'] = {};
        }

        var bittrexMarketFilter = 
            [   
                //'BTC-ETH',
                //'USDT-ETH',
                //'BTC-RDD',
                //'BTC-XRP',
                //'BTC-POT',
                'BTC-LTC',
                //'BTC-XEM',
                //'BTC-DASH',
                //'BTC-BTS',
                //'BTC-DOGE',
                //'BTC-XMR',
                //'BTC-XLM',
                'USDT-BTC',
                'USDT-LTC'
                //'BTC-NEO',
                //'ETH-NEO'
            ];
        var bittrexMarketFilterRelation = 
            [   
                //'ETHBTC',
                //'ETHUSD',
                //"RDDBTC",
                //'XRPBTC',
                //"POTBTC",
                'LTCBTC',
                //'XEMBTC',
                //'DASHBTC',
                //'BTSBTC',
                //'DOGEBTC',
                //'XMRBTC',
                //"XLMBTC",
                "BTCUSD",
                'LTCUSD'
                //'BTCNEO',
                //'ETHNEO'
            ];

        bittrex.options({ 'stream': true });

        bittrexMarketFilter.filter(function(o,i){
            bittrex.getticker( {market :o},function( response ) {
                if(typeof response != 'undefined' && typeof response.Last != 'undefined'){
                    if(typeof bittrexMarketFilterRelation[i] != "undefined"){
                    // for the record :
                        var relation = bittrexMarketFilterRelation[i]
                        if(typeof Exchanges.bittrex[relation] == "undefined"){
                            Exchanges.bittrex[relation] = true
                        }

                        if(typeof  response.Last == "undefined"){
                            return false
                        }

                        if (Exchanges.bittrex[relation] !=  response.Last) {
                            Exchanges.bittrex[relation] =  response['Last'];
                        }
                    }else{
                        console.log("relation not found " + o + ' : ' + i)
                    }
                }
            });    
        });
    },
    'bitfinex': function(symbol) {

         var supportedSymbols = {};
        [
            "BTCUSD",
            "LTCUSD",
            "LTCBTC",
            //"ETHUSD",
            //"ETHBTC",
            //"XMRBTC",
            //"DASHBTC",
            //"ZECBTC",
            //"BCHBTC",
            //"BCHUSD"

        ].filter( function(o){
            supportedSymbols[o] = {
                "event" : "subscribe",
                "channel" : "ticker",
                "pair" : o
            };
        });
       
        if (typeof symbol == "undefined") {
            symbol = [];
            for (key in supportedSymbols) {
                symbol.push(supportedSymbols[key]);
            }
        } else {
            symbol = [supportedSymbols[symbol]];

        }

        this.makeSocket('wss://api2.bitfinex.com:3000/ws', 'bitfinex', function(event) {
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
        }, symbol);

        return true;
    },
    'bitmex': function(symbol) {
        console.log("starting bitmex");
        // to support more bitmex symbols check out their rest API and implement symbols you see from
        // the return of their endpoints
        var symbols = {
          //"ETHUSD": "ETHUSD",
          "XBTUSD" : "BTCUSD",
          //"BCHZ18" : "BCHBTC",
          //"EOSZ18" : "EOSBTC",
          //"TRXZ18" : "TRXBTC",
          //"XRPZ18": 'XRPBTC',
          "LTCZ18": "LTCBTC"
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
                    if(typeof data == "undefined" || typeof data.symbol == "undefined"){
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
            if(typeof symbol == "undefined"){
            // dont forget to filter to only data u want.
                BitstampSocket = pusher.subscribe('live_trades');
                var i = 0;
                BitstampSocket.bind('trade', function(data) {
                    var price = parseFloat(data['price']);
                    if (Exchanges.bitstamp.BTCUSD != price) {
                        Exchanges.bitstamp.BTCUSD = parseFloat(data['price']);
                    }
                });
                /*
                BitstampSocket2 = pusher.subscribe('live_trades_xrpbtc');
                var i = 0;
                BitstampSocket2.bind('trade', function(data) {
                    var price = parseFloat(data['price']);
                    if (Exchanges.bitstamp.XRPBTC != price) {
                        Exchanges.bitstamp.XRPBTC = parseFloat(data['price']);
                    }
                });
                
                 BitstampSocket3 = pusher.subscribe('live_trades_ltcbtc');
                var i = 0;
                BitstampSocket3.bind('trade', function(data) {
                    console.log(data)
                    var price = parseFloat(data['price']);
                    if (Exchanges.bitstamp.LTCBTC != price) {
                        Exchanges.bitstamp.LTCBTC = parseFloat(data['price']);
                    }
                });
                */
            }else{
                // check supported symbol pairs
                var symbolConversion = {
                    'XRPBTC' : 'live_trades_xrpbtc'
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
                    var symbol = data.symbol1 + data.symbol2
                    // REWRITE THIS
                    if (
                            (data.symbol1 == 'BTC' && data.symbol2 == 'USD') || 
                            
                           // (data.symbol1 == 'ETH' && data.symbol2 == 'BTC') || 
                           // (data.symbol1 == 'ETH' && data.symbol2 == 'USD') ||
                            
                            (data.symbol1 == 'LTC' && data.symbol2 == 'USD') ||
                            (data.symbol1 == 'LTC' && data.symbol2 == 'BTC') 

                            ) {
                        var tickerCode = data.symbol1 + data.symbol2;
                        if(typeof symbol == "string" && tickerCode != symbol){
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
        var query =[{
            "type": "subscribe",
            "product_id": "BTC-USD"
        }, 
        //{
        //    "type": "subscribe",
        //    "product_id": "ETH-BTC"
        //},
        {
            "type" : "subscribe",
            "product_id" : "LTC-BTC"
        }].filter((item) => {
          return typeof symbol == 'undefined' || norm(item.product_id) == symbol 
        });      
        this.makeSocket('wss://ws-feed.gdax.com/', 'gdax', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && typeof data.type != "undefined") {
                    var tickerValue = parseFloat(data.price);                    
                    if (tickerValue != Exchanges.gdax[norm(data.product_id)] )  {
                      Exchanges.gdax[norm(data.product_id)]  = tickerValue 
                    }
                }
            }
        }, query)
    },
    'gemini': function(symbol) {
        if(typeof symbol != "undefined" && symbol == 'ETHBTC'){
            ;
        }else{
            this.makeSocket('wss://api.gemini.com/v1/marketdata/btcusd', 'gemini', function(event) {
                if (typeof event.data != "undefined") {
                    var data = JSON.parse(event.data);
                    if (data && typeof data.events != "undefined") {
                        data = data.events[0];
                        if (data.type == "trade") {
                            if(typeof Exchanges.gemini == "undefined"){
                                Exchanges.gemini = {};
                            }
                            var tickerValue = parseFloat(data.price);
                            Exchanges.gemini["BTCUSD"] = tickerValue;

                        }
                    }
                }
            });
        }
        /*
        this.makeSocket('wss://api.gemini.com/v1/marketdata/ethbtc', 'gemini2', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && typeof data.events != "undefined") {
                    data = data.events[0];
                    if (data.type == "trade") {
                        var tickerValue = parseFloat(data.price);
                        if(typeof Exchanges.gemini == "undefined"){
                            Exchanges.gemini = {};
                        }
                        Exchanges.gemini["ETHBTC"] = tickerValue;

                    }
                }
            }
        });
        */
        this.makeSocket('wss://api.gemini.com/v1/marketdata/ltcusd', 'gemini2', function(event) {
            if (typeof event.data != "undefined") {
                var data = JSON.parse(event.data);
                if (data && typeof data.events != "undefined") {
                    data = data.events[0];
                    if (data.type == "trade") {
                        var tickerValue = parseFloat(data.price);
                        if(typeof Exchanges.gemini == "undefined"){
                            Exchanges.gemini = {};
                        }
                        Exchanges.gemini["LTCUSD"] = tickerValue;

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
        /*
        {
            "event": "addChannel",
            "channel": "ok_ethusd_ticker",
            "pair": "ETHUSD"
            //"prec" : "P0"
        }
        */];

        if(typeof symbol == "string" && symbol == "LTCUSD"){    
            query.shift();
        }else if(typeof symbol == "string" && symbol == "BTCUSD"){
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
        var wsuri = "wss://api2.poloniex.com";
        //Sockets.poloniex = new autobahn.Connection({
       //     url: wsuri,
        //    realm: "realm1"
        //});
        var query = {
          "command": "subscribe",
          "channel": 1002
        }
        if (typeof Exchanges.poloniex == "undefined") {
            Exchanges.poloniex = {};
        }
        // currency pairs (WHY IS THIS NOT AN ENDPOINT!??!?!?!?)
        var pairIds={
                    "7" : "BTC_BCN",
                    "14" : "BTC_BTS",
                    "15" : "BTC_BURST",
                    "20" : "BTC_CLAM",
                    "25" : "BTC_DGB",
                    "27"   : "BTC_DOGE",
                    "24"   : "BTC_DASH",
                    "38"   : "BTC_GAME",
                    "43"   : "BTC_HUC",
                    "50"   : "BTC_LTC",
                    "51"   : "BTC_MAID",
                    "58"   : "BTC_OMNI",
                    "61"   : "BTC_NAV",
                    "64"   : "BTC_NMC",
                    "69"   : "BTC_NXT",
                    "75"   : "BTC_PPC",
                    "89"   : "BTC_STR",
                    "92"   : "BTC_SYS",
                    "97"   : "BTC_VIA",
                    "100"  : "BTC_VTC",
                    "108"  : "BTC_XCP",
                    "114" : "BTC_XMR",
                    "116" : "BTC_XPM",
                    "117" : "BTC_XRP",
                    "112" : "BTC_XEM",
                    "148" : "BTC_ETH",
                    "150" : "BTC_SC",
                    "155"  : "BTC_FCT",
                    "162"  : "BTC_DCR",
                    "163"  : "BTC_LSK",
                    "167"  : "BTC_LBC",
                    "168"  : "BTC_STEEM",
                    "170"  : "BTC_SBD",
                    "171"  : "BTC_ETC",
                    "174"  : "BTC_REP",
                    "177"  : "BTC_ARDR",
                    "178" : "BTC_ZEC",
                    "182" : "BTC_STRAT",
                    "184" : "BTC_PASC",
                    "185" : "BTC_GNT",
                    "189" : "BTC_BCH",
                    "192" : "BTC_ZRX",
                    "194" : "BTC_CVC",
                    "196" : "BTC_OMG",
                    "198" : "BTC_GAS",
                    "200" : "BTC_STORJ",
                    "201" : "BTC_EOS",
                    "204" : "BTC_SNT",
                    "207" : "BTC_KNC",
                    "210" : "BTC_BAT",
                    "213" : "BTC_LOOM",
                    "221" : "BTC_QTUM",
                    "232" : "BTC_BNT",
                    "229" : "BTC_MANA",
                    "121" : "USDT_BTC",
                    "216" : "USDT_DOGE",
                    "122" : "USDT_DASH",
                    "123" : "USDT_LTC",
                    "124" : "USDT_NXT",
                    "125" : "USDT_STR",
                    "126" : "USDT_XMR",
                    "127" : "USDT_XRP",
                    "149" : "USDT_ETH",
                    "219" : "USDT_SC",
                    "218" : "USDT_LSK",
                    "173" : "USDT_ETC",
                    "175" : "USDT_REP",
                    "180" : "USDT_ZEC",
                    "217" : "USDT_GNT",
                    "191" : "USDT_BCH",
                    "220" : "USDT_ZRX",
                    "203" : "USDT_EOS",
                    "206" : "USDT_SNT",
                    "209" : "USDT_KNC",
                    "212" : "USDT_BAT",
                    "215" : "USDT_LOOM",
                    "223" : "USDT_QTUM",
                    "234" : "USDT_BNT",
                    "231" : "USDT_MANA",
                    "129" : "XMR_BCN",
                    "132" : "XMR_DASH",
                    "137" : "XMR_LTC",
                    "138" : "XMR_MAID",
                    "140" : "XMR_NXT",
                    "181" : "XMR_ZEC",
                    "166" : "ETH_LSK",
                    "169" : "ETH_STEEM",
                    "172" : "ETH_ETC",
                    "176" : "ETH_REP",
                    "179" : "ETH_ZEC",
                    "186" : "ETH_GNT",
                    "190" : "ETH_BCH",
                    "193" : "ETH_ZRX",
                    "195" : "ETH_CVC",
                    "197" : "ETH_OMG",
                    "199" : "ETH_GAS",
                    "202" : "ETH_EOS",
                    "205" : "ETH_SNT",
                    "208" : "ETH_KNC",
                    "211" : "ETH_BAT",
                    "214" : "ETH_LOOM",
                    "222" : "ETH_QTUM",
                    "233" : "ETH_BNT",
                    "230" : "ETH_MANA",
                    "224" : "USDC_BTC",
                    "226" : "USDC_USDT",
                    "225" : "USDC_ETH"
        }
        this.makeSocket('wss://api2.poloniex.com','poloniex', function(event){
            if(typeof event != 'undefined' && typeof event.data != 'undefined'){
                try{
                    var args = JSON.parse(event.data)
                        if(typeof args == 'object' && typeof args[2] != 'undefined' && args[2].length > 0){
                            // EX : [1002,null,[201,"0.00083453","0.00083489","0.00083057","0.01221405","3.18906644","3842.61804400",0,"0.00083500","0.00082431"]]
                            var data = args[2]
                            var currencyId = data[0].toString()
                            if(typeof pairIds[currencyId] != 'undefined'){

                                var currencyPair = pairIds[currencyId]
                                var codeConversion = {
                                    "BTC_ETH"  : "ETHBTC",
                                    "USDT_BTC" : "BTCUSD",
                                    "USDT_LTC" : "LTCUSD",
                                     "USDT_ETH" : "LTCETH",
                                    "USDT_XRP" : "XRPUSD",
                                    "USDT_DASH" : "DASHUSD",
                                    'USDT_XMR' : "XMRUSD",
                                    'USDT_ZEC' : "ZECUSD",
                                    //"USDT_STR" : "STRUSD",
                                    //'USDT_REP' : "REPUSD",
                                    "USDT_NXT" : "NXTUSD",
                                    "BTC_LTC" : "LTCBTC",
                                    "BTC_DASH" : "DASHBTC",
                                    //"USDT_DASH" : "DASHUSD",
                                    //"BTC_LSK" : "LSKBTC",
                                    "USDT_ETH" : "ETHUSD",
                                    "BTC_POT" : "POTBTC",
                                    "BTC_XMR" : "XMRBTC",
                                    "BTC_DOGE" : "DOGEBTC",
                                    "BTC_ZEC" : "ZECBTC",
                                    "BTC_XLM" : "XLMBTC",
                                    "BTC_ETC" : "ETCBTC",
                                    //"BTC_FTC" : "FTCBTC",
                                    "BTC_MAID" : "MAIDBTC",
                                    "BTC_XEM" : "XEMBTC",
                                    //"BTC_PASC" : "PASCBTC",
                                    "BTC_BTS" : "BTSBTC",
                                    "BTC_BCH" : "BCHBTC",
                                    "USDT_BCH" : "BCHUSD",
                                    "BTC_XRP" : "XRPBTC"
                                }
                                var tickerCode = (typeof codeConversion[currencyPair] != "undefined" ? codeConversion[currencyPair] : false);
                                /*
                                if((tickerCode != symbol && typeof symbol != "undefined") || !tickerCode){
                                    return false;
                                }
                                */
                                if(tickerCode){
                                    tickerValue = parseFloat(data[1]);

                                    if (Exchanges.poloniex[tickerCode] != tickerValue) {
                                        Exchanges.poloniex[tickerCode] = tickerValue;
                                    }
                                }
                            }else{
                                console.log("*** Poloneix currencyPair id: \t" + data +" not found")
                            }
                    }

                }catch(e){
                    ;
                }
            }
        },query)


        Sockets.poloniex.onclose = function() {
            console.log("Polosocket connection closed");
        }
       // Sockets.poloniex.open();
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
    'start': function(exchange,symbols) {
        if (typeof exchange == "undefined") {
            var self = this;

            supportedExchanges.filter(function(e) {
                console.log(e);
                self[e](symbols);
            });
        }else{
            try{
                this[exchange](symbols);
            }catch(error){
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
