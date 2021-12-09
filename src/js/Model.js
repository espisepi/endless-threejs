import { AnimationMixer, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

class Model extends Object3D {
  constructor() {
    super();
    let that = this;
    this.mixers = [];
    let loader = new GLTFLoader();
    loader.load(
      "./assets/models/Xbot.glb",
      (gltf) => {
        let model = gltf.scene;
        model.frustumCulled = false;
        //console.log(model);
        model.children[0].children[1].material.color.set(0x323232); // joints
        //model.children[0].children[2].material.color.set(0xff647f); // parts
        model.rotation.y = Math.PI;
        model.scale.setScalar(2);
        let mixer = new AnimationMixer(model);
        mixer.timeScale = 0.125;
        that.mixers.push(mixer);
        let action = mixer.clipAction(gltf.animations[3]);
        action.play();

        that.add(model);
      },
      null,
      (err) => {
        console.error("An error happened.", err);
      }
    );
    this.update = (t) => {
      this.mixers.forEach((mix) => {
        mix.update(t);
      });
    };
  }
}
export { Model };
