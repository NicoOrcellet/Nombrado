import { NameServer } from './nameServer';


/**
* Este script lanza 3 servidores para la demostración:
* - root (port 3000) con children [http://localhost:3001]
* - ns1 (port 3001) con children [http://localhost:3002]
* - ns2 (port 3002) sin children
*
* Se pueden registrar nombres en cualquiera de ellos usando 
* POST /register y luego resolverlos consultando el root.
*/


const root = new NameServer('root', 3000, ['http://localhost:3001']);
const ns1 = new NameServer('ns1', 3001, ['http://localhost:3002']);
const ns2 = new NameServer('ns2', 3002, []);


root.start();
ns1.start();
ns2.start();


console.log('Servers started: root(3000) -> ns1(3001) -> ns2(3002)');