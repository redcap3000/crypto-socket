cryptoSocket = require("./index.js");

cryptoSocket.start();

setInterval(
  function(){
            cryptoSocket.echoExchange()
                
  },1000
);
