// Asegúrate de que el navegador es compatible con WebXR
if (navigator.xr) {
    navigator.xr.requestDevice({ immersive: true })
        .then(device => {
            device.requestSession({ immersive: true, environment: 'local' })
                .then(session => {
                    console.log('Sesión de WebXR iniciada');
                    // Aquí puedes agregar el contenido 3D de Three.js o cualquier otro contenido AR
                })
                .catch(err => console.log('Error al iniciar la sesión:', err));
        })
        .catch(err => console.log('Dispositivo WebXR no compatible:', err));
} else {
    alert('Tu navegador no es compatible con WebXR');
}