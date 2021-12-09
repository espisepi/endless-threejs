import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Terrain } from "./js/Terrain";
import { Model } from "./js/Model";

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 7);
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xcccccc);
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.5;
controls.enableDamping = true;
controls.update();

let hemiLight = new THREE.HemisphereLight(0xffffff, 0x646464, 1.5);
scene.add(hemiLight);

let moveables = [new Terrain(400, 1600, 41, 120), new Model()];
moveables.forEach((mov) => {
  scene.add(mov);
});

let clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  let t = clock.getDelta() * 4.125;
  moveables.forEach((m) => {
    m.update(t);
  });
  controls.update();
  renderer.render(scene, camera);
});
