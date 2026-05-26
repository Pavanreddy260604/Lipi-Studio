import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { Scene } from '../models/scene/model.js';

const NEW_CONTENT = `EXT. RIVERBANK VILLAGE - MORNING

The Ganga river flows serenely. On the bank, amidst a cluster of simple mud-and-thatch huts, ADHIRATHA (50s), a man with calloused hands and kind, weathered eyes, completes his morning prayers to the rising sun.

He straightens, his movements reflecting a lifetime of physical labor as a charioteer.

A sound pierces the morning calm. Faint, but sharp. The cry of an infant.

Adhiratha freezes. He scans the riverbank. Nothing. The cry comes again, a desperate, lonely wail carried on the breeze. It seems to come from the water itself.

His eyes follow the sound, landing on a dense patch of reeds where the current slows. Something is caught there. A small, woven basket, identical to the one from the previous scene.

He wades into the shallows, the water swirling around his dhoti. As he nears, the crying grows louder. He parts the tall reeds.

And stops.

Inside the basket lies an INFANT, impossibly small, his face red from crying. A faint, almost imperceptible golden glow emanates from a small armor-like plate on his chest and from tiny earrings that seem fused to his earlobes.

Adhiratha stares, captivated. He looks up and down the empty riverbank. Who would leave such a child?

RADHA (40s), a woman with a gentle face etched with a quiet, unspoken sorrow, approaches the riverbank.

<center>RADHA</center>
> Adhiratha? Is everything alright?

He doesn’t turn, his gaze locked on the basket. She follows his line of sight. Her brow furrows in confusion, then concern. She wades into the water to stand beside him.

She peers into the basket.

A sharp gasp. Her hand flies to her mouth. Not in horror, but in utter wonder.

At the sound, the infant’s cries soften. His tiny eyes flutter open, blinking against the morning light. He looks up at the two faces peering down at him.

Tears well in Radha’s eyes. A deep, maternal longing she has carried for years surfaces with breathtaking force. She reaches a trembling hand, not yet daring to touch, hovering it over the child’s head like a blessing.

Adhiratha watches his wife’s reaction. He sees the sorrow in her face replaced by a light he hasn’t seen in years. A silent understanding passes between them.

With immense care, Adhiratha lifts the basket from the water. It’s heavy, substantial. He holds it out to her. A gift.

Radha’s hands meet his, and together, they lift their son from the river. The infant lets out a soft, contented coo.

FADE OUT.`;

async function main() {
    await connectDB();
    try {
        const scene = await Scene.findOne({ title: "The Charioteer's Gift" });
        if (scene) {
            scene.content = NEW_CONTENT.trim();
            scene.status = 'drafted'; // Mark it as drafted now that we have content
            await scene.save();
            console.log('Scene updated successfully in MongoDB!');
            console.log(`- ID: ${scene._id}`);
            console.log(`- Title: ${scene.title}`);
            console.log(`- New Content Length: ${scene.content.length}`);
        } else {
            console.log("Scene not found");
        }
    } catch (err) {
        console.error('Error updating scene:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

main();
