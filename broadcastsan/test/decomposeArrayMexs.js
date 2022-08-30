const fs = require('fs');


var mexsFile = JSON.parse(fs.readFileSync("./messages.bulk"));

console.log("total: ", mexsFile.length);
let res = prepareMessages(mexsFile,40000);
//console.log("chunks tot:", res);
res.forEach( e => console.log("aaaa",e.length))
fs.writeFileSync("./messaggi1",JSON.stringify(res[0],null,4));
fs.writeFileSync("./messaggi2",JSON.stringify(res[1],null,4));


function prepareMessages(mexs,limit){
    if(!Array.isArray(mexs[0])) mexs = [mexs];
    if (mexs.every( e => JSON.stringify(e).length < limit)) return mexs;

    let temp = [];
    mexs = mexs.map( chunk => {
      if(JSON.stringify(chunk).length < limit) {
        return chunk;
      }
      temp.push(chunk.slice(0, Math.ceil(chunk.length / 2)));
      temp.push(chunk.slice(Math.ceil(chunk.length / 2), chunk.length ));
      return null;
    } ).filter(e => e !== null);

    mexs = mexs.concat(temp);
    return prepareMessages(mexs,limit);
}
