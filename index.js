const vertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const fragmentShader = `
uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;

varying vec2 vUv;

void main() {
    gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
}
`

const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });

class BloomRenderer {
    constructor({ 
        scene, camera, renderer,
        embedded = false, width = window.innerWidth, height = window.innerHeight,
        exposure = 0.8, strength = 4, radius = 0.5, threshold = 0, layer = 1 
    }) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.renderer.toneMappingExposure = Math.pow(exposure, 4);

        this.materials = {};

        this.layer = layer;
        this.settings = {
            strength,
            radius,
            threshold
        }

        const renderScene = new THREE.RenderPass(scene, camera);

        this.bloomLayer = new THREE.Layers();
        this.bloomLayer.set(this.layer);

        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold);

        this.bloomComposer = new THREE.EffectComposer(renderer);
        this.bloomComposer.renderToScreen = false;
        this.bloomComposer.addPass(renderScene);
        this.bloomComposer.addPass(bloomPass);

        const finalPass = new THREE.ShaderPass(
            new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
                },
                vertexShader,
                fragmentShader,
                defines: {}
            }),
            'baseTexture'
        );
        finalPass.needsSwap = true;

        this.finalComposer = new THREE.EffectComposer(renderer);
        this.finalComposer.addPass(renderScene);
        this.finalComposer.addPass(finalPass);

        this.darkenNonBloomed = this.darkenNonBloomed.bind(this);
        this.restoreMaterial = this.restoreMaterial.bind(this);

        if (!embedded) window.addEventListener('resize', () => this.resize());
    }

    enableObjects(objs = []) {
        if (Array.isArray(objs)) objs.forEach(obj => obj.layers.enable(this.layer));
        else objs.layers.enable(this.layer);
    }

    render() {
        // render scene with bloom
        this.scene.traverse(this.darkenNonBloomed);
        this.bloomComposer.render();
        this.scene.traverse(this.restoreMaterial);
        // render the entire scene, then render bloom scene on top
        this.finalComposer.render();
    }
    darkenNonBloomed(obj) {
        if (obj.isMesh && this.bloomLayer.test(obj.layers) === false) {
            this.materials[ obj.uuid ] = obj.material;
            obj.material = darkMaterial;
        }
    }
    restoreMaterial(obj) {
        if (this.materials[ obj.uuid ]) {
            obj.material = this.materials[ obj.uuid ];
            delete this.materials[ obj.uuid ];
        }
    }

    resize({ width = window.innerWidth, height = window.innerHeight }) {
        this.bloomComposer.setSize(width, height);
        this.finalComposer.setSize(width, height);
    }
}

export { BloomRenderer }
export default BloomRenderer