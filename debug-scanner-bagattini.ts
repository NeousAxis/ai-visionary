
import { scanUrlForAioSignals } from './lib/aio-scanner';

async function testScan() {
    console.log("--- TEST SCANNER DIAGNOSTIC ---");
    const target = "https://bagattinisa.ch/";
    console.log(`Scanning: ${target}`);

    try {
        const result = await scanUrlForAioSignals(target);
        console.log("RESULTATS BRUTS :");
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("CRASH:", error);
    }
}

testScan();
