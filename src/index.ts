import { App } from './app'

async function main(){
    const app = new App(3000);
    app.listen();
}

main();