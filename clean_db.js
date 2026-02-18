const { db } = require('./lib/db'); 
async function clean() {
  console.log('Cleaning GlobalWorkflow and Eclore...');
  
  // 1. Global Workflow
  const ent1 = await db.getAyaEntityByUrl('https://globalworkflow.xyz');
  if(ent1) {
    console.log('Deleting GW:', ent1.aya_entity_id);
    const fs = require('firebase-admin/firestore');
    await fs.getFirestore().collection('aya_registry').doc(ent1.aya_entity_id).delete();
  }

  // 2. Association Eclore (Assuming url is association-eclore.fr or similar, trying search)
  // Let's list last entities to find it
  const list = await db.getAyaEntities(20);
  const eclore = list.find(e => e.legal_name.includes('Eclore') || e.display_name.includes('Eclore'));
  if(eclore) {
      console.log('Deleting Eclore:', eclore.aya_entity_id);
      const fs = require('firebase-admin/firestore');
      await fs.getFirestore().collection('aya_registry').doc(eclore.aya_entity_id).delete();
  } else {
      console.log('Eclore not found in recent list.');
  }

  console.log('Done.');
  process.exit(0);
}
clean();
