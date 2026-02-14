const RGL = require('react-grid-layout');
console.log('Keys:', Object.keys(RGL));
console.log('RGL:', RGL);
try {
    console.log('WidthProvider:', RGL.WidthProvider);
    console.log('Responsive:', RGL.Responsive);
} catch (e) {
    console.log(e);
}
