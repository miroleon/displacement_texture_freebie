// Import Three.js
import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';

// Import the RGBELoader to add the gradient HDR to the scene later
import { RGBELoader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/RGBELoader.js';

// Import the EffectComposer to add post processing later, which is necessary for the displacement effect to work
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';

// Import the RenderPass to render the scene to the composer, which is also necessary for the displacement effect to work
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';

// Import the ShaderPass to add the displacement effect to the scene
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/ShaderPass.js';

// Import the AfterimagePass to add the afterimage effect to the scene
import { AfterimagePass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/AfterimagePass.js';

// Import the UnrealBloomPass to add the bloom effect to the scene
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// Import the FBXLoader to load the 3d model
// You have to import another loader if you are using a different 3d model format
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/FBXLoader.js';

import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';

// Create a renderer
var renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), antialias: true });

// Set a default background color
renderer.setClearColor(0x11151c);

//  Set the pixel ratio of the canvas (for HiDPI devices)
renderer.setPixelRatio(window.devicePixelRatio);

// Set the size of the renderer to the size of the window
renderer.setSize(window.innerWidth, window.innerHeight);

// Create a new Three.js scene
var scene = new THREE.Scene();

// Create a new camera
var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

// Set the camera position
camera.position.set(0, 0, 10);

// Add controls to the camera/orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = true;
controls.dampingFactor = 1;
controls.enablePan = false;

// Limit the angel that the camera can move
const angleLimit = Math.PI / 7;
controls.minPolarAngle = Math.PI / 2 - angleLimit;
controls.maxPolarAngle = Math.PI / 2 + angleLimit;

// Add a gradient HDR background
const hdrEquirect = new RGBELoader()
    .setPath('https://miroleon.github.io/daily-assets/')
    .load('GRADIENT_01_01_comp.hdr', function () {

        hdrEquirect.mapping = THREE.EquirectangularReflectionMapping;
    });

// Add the HDR to the scene
scene.environment = hdrEquirect;

// Add some fog to the scene for moodyness
scene.fog = new THREE.Fog(0x11151c, 1, 100);
scene.fog = new THREE.FogExp2(0x11151c, 0.4);

// Load a texture for the 3d model
var surfaceImperfection = new THREE.TextureLoader().load('https://miroleon.github.io/daily-assets/surf_imp_02.jpg');
surfaceImperfection.wrapT = THREE.RepeatWrapping;
surfaceImperfection.wrapS = THREE.RepeatWrapping;

// Create a new MeshPhysicalMaterial for the 3d model
var hands_mat = new THREE.MeshPhysicalMaterial({
    color: 0x606060,
    roughness: 0.2,
    metalness: 1,
    roughnessMap: surfaceImperfection,
    envMap: hdrEquirect,
    // Set the strenth of the environment map on the texture
    envMapIntensity: 1.5
});

// Load the 3d model as FBX
const fbxloader = new FBXLoader();
fbxloader.load('https://miroleon.github.io/daily-assets/two_hands_01.fbx', function (object) {

    // Traverse through the object to apply the material to all the meshes
    object.traverse(function (child) {
        // Apply the material to the 3d model
        if (child.isMesh) {
            child.material = hands_mat;
        }
    });

    // Set the position and scale of the 3d model
    object.position.set(0, 0, 0);
    object.scale.setScalar(0.05);

    // Add the 3d model to the scene
    scene.add(object);
});

// POST PROCESSING
// Create a new render pass
const renderScene = new RenderPass(scene, camera);

// Create a new afterimage pass
const afterimagePass = new AfterimagePass();

// Set the damping of the afterimage pass
afterimagePass.uniforms['damp'].value = 0.9;

// Set bloom parameters
const bloomparams = {
    exposure: 1,
    bloomStrength: 1.75,
    bloomThreshold: 0.1,
    bloomRadius: 1
};

// Create a new bloom pass
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = bloomparams.bloomThreshold;
bloomPass.strength = bloomparams.bloomStrength;
bloomPass.radius = bloomparams.bloomRadius;

// Create the displacement shader with vertexShader and fragmentShader
const displacementShader = {
    uniforms: {
        // tDiffuse is the texture that the shader will be applied to, in this case the Three.js scene
        tDiffuse: { value: null },
        // displacement is the texture that will be used to displace the pixels
        displacement: { value: null },
        // scale is the intensity of the displacement
        scale: { value: 0.1 },
        // tileFactor is the number of times the texture will be repeated across the screen
        tileFactor: { value: 2 }
    },
    // This particular vertex shader is basically a Three.js specific boilerplate code
    //It allows us to connect the vertex shader to the Three.js scene
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    // The fragment shader determines the color of each pixel on the screen
    // Here we are displacing the pixels based on the displacement texture
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D displacement;
        uniform float scale;
        uniform float tileFactor;
        varying vec2 vUv;
        void main() {
            // We use the conditional here to apply the displacement only to part of the scene/screen
            // You can simply cut the if condition and apply the displacement to the entire screen

            if (vUv.x < 0.5 && vUv.x > 0.0 && vUv.y < 1.0 && vUv.y > 0.0) {
                vec2 tiledUv = mod(vUv * tileFactor, 1.0);
                vec2 disp = texture2D(displacement, tiledUv).rg * scale;
                vec2 distUv = vUv + disp;

                // By setting gl_FragColor to the displacement texture accross the distibuted UVs we get the displacement effect
                // You can check the texture by simply substituting the 'tDiffuse' with 'displacement'

                gl_FragColor = texture2D(tDiffuse, distUv);
            } else {
                gl_FragColor = texture2D(tDiffuse, vUv);  // No displacement on the right half
            }
        }
    `
};

// Load the displacement texture
const displacementTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/miroleon/displacement_texture_freebie/main/assets/1K/jpeg/normal/ml-dpt-21-1K_normal.jpeg', function (texture) {
    // By setting minFilter to THREE.NearestFilter we can prevent some tiling issues with the displacement texture
    texture.minFilter = THREE.NearestFilter;
});

// Create a new ShaderPass with the displacementShader
// This adds the displacement effect to the scene
const displacementPass = new ShaderPass(displacementShader);

// Here you can select which texture to use for the displacement
displacementPass.uniforms['displacement'].value = displacementTexture;

// Adjust scale to control the intensity of distortion
displacementPass.uniforms['scale'].value = 0.05;

// Adjust tileFactor to control the number of repetitions of the texture, which basically makes it smaller or larger
displacementPass.uniforms['tileFactor'].value = 2;

// Create a new EffectComposer to add all the passes to the scene
let composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(afterimagePass);
composer.addPass(bloomPass);

// Add the displacement pass to the composer
composer.addPass(displacementPass);

// The following section is just a custom way to handle the orbit controls and transition smoothly between user interaction and default camera movement

// Easing function to smoothen the transition
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Variables to control the transition
let isUserInteracting = false;
let transitionProgress = 0;
let transitionTime = 2;  // Transition should complete over 5 seconds
let transitionIncrement = 1 / (60 * transitionTime);  // Assuming 60 FPS
let transitionStartCameraPosition = new THREE.Vector3();
let transitionStartCameraQuaternion = new THREE.Quaternion();

var theta = 0;
var update = function () {
    // Update theta continuously
    theta += 0.005;

    let targetPosition = new THREE.Vector3(
        Math.sin(theta) * 3,
        Math.sin(theta),
        Math.cos(theta) * 3
    );

    let targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -theta, 0));

    if (isUserInteracting) {
        if (transitionProgress > 0) {
            // If interaction starts while transitioning, immediately cancel the transition
            transitionProgress = 0;
        }
        // Store the current camera state at the start of user interaction
        transitionStartCameraPosition.copy(camera.position);
        transitionStartCameraQuaternion.copy(camera.quaternion);
    } else {
        if (transitionProgress < 1) {
            transitionProgress += transitionIncrement;  // Increment the progress towards the scripted path
            let easedProgress = easeInOutCubic(transitionProgress);

            // Smoothly interpolate camera position and rotation using eased progress
            camera.position.lerpVectors(transitionStartCameraPosition, targetPosition, easedProgress);
            camera.quaternion.slerp(transitionStartCameraQuaternion, targetQuaternion, easedProgress);
        } else {
            // Ensure the camera fully aligns with the scripted path once transition is complete
            camera.position.copy(targetPosition);
            camera.quaternion.copy(targetQuaternion);
        }
    }

    // Always look towards a particular point (if needed)
    camera.lookAt(scene.position);
};

// Event listeners for OrbitControls
controls.addEventListener('start', function () {
    isUserInteracting = true;
});

controls.addEventListener('end', function () {
    isUserInteracting = false;
    // Start the transition from the last known positions
    transitionStartCameraPosition.copy(camera.position);
    transitionStartCameraQuaternion.copy(camera.quaternion);
    transitionProgress = 0; // Reset progress to start the transition back to scripted control
});

// Resize function to adjust camera and renderer on window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Only needed if damping or auto-rotation is enabled

    // Make sure to update the composer
    composer.render();

    update();
}

requestAnimationFrame(animate);