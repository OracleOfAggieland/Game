// src/utils/WebGLRenderer.ts

export interface RenderObject {
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number, number]; // RGBA
  type: 'rect' | 'circle';
}

/**
 * WebGL-based renderer for high-performance game rendering
 * Falls back to Canvas if WebGL is not available
 */
export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private isWebGLSupported: boolean = false;
  private ctx2d: CanvasRenderingContext2D | null = null;

  // Vertex shader source
  private vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec4 a_color;
    
    uniform vec2 u_resolution;
    
    varying vec4 v_color;
    
    void main() {
      // Convert from pixels to 0.0 to 1.0
      vec2 zeroToOne = a_position / u_resolution;
      
      // Convert from 0->1 to 0->2
      vec2 zeroToTwo = zeroToOne * 2.0;
      
      // Convert from 0->2 to -1->+1 (clipspace)
      vec2 clipSpace = zeroToTwo - 1.0;
      
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      
      v_color = a_color;
    }
  `;

  // Fragment shader source
  private fragmentShaderSource = `
    precision mediump float;
    
    varying vec4 v_color;
    
    void main() {
      gl_FragColor = v_color;
    }
  `;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initializeRenderer();
  }

  /**
   * Initialize the renderer (WebGL or Canvas fallback)
   */
  private initializeRenderer(): void {
    // Try to initialize WebGL
    try {
      this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext || 
                this.canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      
      if (this.gl) {
        this.initializeWebGL();
        this.isWebGLSupported = true;
        console.log('WebGL renderer initialized successfully');
      } else {
        throw new Error('WebGL not supported');
      }
    } catch (error) {
      console.warn('WebGL initialization failed, falling back to Canvas:', error);
      this.initializeCanvas();
    }
  }

  /**
   * Initialize WebGL context and shaders
   */
  private initializeWebGL(): void {
    if (!this.gl) return;

    // Create shaders
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, this.vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    // Create program
    this.program = this.gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create WebGL program');
    }

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(this.program);
      throw new Error(`Failed to link program: ${error}`);
    }

    // Create buffers
    this.positionBuffer = this.gl.createBuffer();
    this.colorBuffer = this.gl.createBuffer();

    // Set up viewport
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Initialize Canvas 2D fallback
   */
  private initializeCanvas(): void {
    this.ctx2d = this.canvas.getContext('2d');
    if (!this.ctx2d) {
      throw new Error('Failed to get 2D context');
    }
    this.isWebGLSupported = false;
  }

  /**
   * Create a WebGL shader
   */
  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader);
      console.error('Shader compilation error:', error);
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Clear the canvas
   */
  public clear(r: number = 0, g: number = 0, b: number = 0, a: number = 1): void {
    if (this.isWebGLSupported && this.gl) {
      this.gl.clearColor(r, g, b, a);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    } else if (this.ctx2d) {
      this.ctx2d.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Render multiple objects efficiently
   */
  public renderObjects(objects: RenderObject[]): void {
    if (this.isWebGLSupported) {
      this.renderObjectsWebGL(objects);
    } else {
      this.renderObjectsCanvas(objects);
    }
  }

  /**
   * Render objects using WebGL
   */
  private renderObjectsWebGL(objects: RenderObject[]): void {
    if (!this.gl || !this.program || !this.positionBuffer || !this.colorBuffer) return;

    // Prepare vertex data
    const positions: number[] = [];
    const colors: number[] = [];

    objects.forEach(obj => {
      if (obj.type === 'rect') {
        // Two triangles for rectangle
        const x1 = obj.x;
        const y1 = obj.y;
        const x2 = obj.x + obj.width;
        const y2 = obj.y + obj.height;

        // Triangle 1
        positions.push(x1, y1, x2, y1, x1, y2);
        // Triangle 2
        positions.push(x1, y2, x2, y1, x2, y2);

        // Colors for all 6 vertices
        for (let i = 0; i < 6; i++) {
          colors.push(...obj.color);
        }
      } else if (obj.type === 'circle') {
        // Approximate circle with triangles
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const radius = Math.min(obj.width, obj.height) / 2;
        const segments = 16;

        for (let i = 0; i < segments; i++) {
          const angle1 = (i / segments) * Math.PI * 2;
          const angle2 = ((i + 1) / segments) * Math.PI * 2;

          // Center point
          positions.push(centerX, centerY);
          // First edge point
          positions.push(
            centerX + Math.cos(angle1) * radius,
            centerY + Math.sin(angle1) * radius
          );
          // Second edge point
          positions.push(
            centerX + Math.cos(angle2) * radius,
            centerY + Math.sin(angle2) * radius
          );

          // Colors for triangle
          for (let j = 0; j < 3; j++) {
            colors.push(...obj.color);
          }
        }
      }
    });

    // Upload data to GPU
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);

    // Use shader program
    this.gl.useProgram(this.program);

    // Set up attributes
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
    const colorLocation = this.gl.getAttribLocation(this.program, 'a_color');
    const resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');

    // Set resolution uniform
    this.gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

    // Bind position attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Bind color attribute
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    this.gl.enableVertexAttribArray(colorLocation);
    this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);

    // Draw
    this.gl.drawArrays(this.gl.TRIANGLES, 0, positions.length / 2);
  }

  /**
   * Render objects using Canvas 2D
   */
  private renderObjectsCanvas(objects: RenderObject[]): void {
    if (!this.ctx2d) return;

    objects.forEach(obj => {
      const [r, g, b, a] = obj.color;
      this.ctx2d!.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;

      if (obj.type === 'rect') {
        this.ctx2d!.fillRect(obj.x, obj.y, obj.width, obj.height);
      } else if (obj.type === 'circle') {
        this.ctx2d!.beginPath();
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const radius = Math.min(obj.width, obj.height) / 2;
        this.ctx2d!.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx2d!.fill();
      }
    });
  }

  /**
   * Check if WebGL is supported and active
   */
  public isWebGLActive(): boolean {
    return this.isWebGLSupported;
  }

  /**
   * Get renderer type for debugging
   */
  public getRendererType(): 'webgl' | 'canvas' {
    return this.isWebGLSupported ? 'webgl' : 'canvas';
  }

  /**
   * Resize the renderer
   */
  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.isWebGLSupported && this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    if (this.gl && this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
    }
    if (this.gl && this.colorBuffer) {
      this.gl.deleteBuffer(this.colorBuffer);
    }
  }
}

/**
 * Device capability detection for automatic renderer selection
 */
export class DeviceCapabilities {
  /**
   * Check if WebGL is supported
   */
  public static isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  /**
   * Get device performance tier (rough estimation)
   */
  public static getPerformanceTier(): 'low' | 'medium' | 'high' {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    
    if (!gl) return 'low';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      
      // Simple heuristics based on GPU names
      if (renderer.includes('Intel HD') || renderer.includes('Intel UHD')) {
        return 'low';
      } else if (renderer.includes('GTX') || renderer.includes('RTX') || renderer.includes('Radeon')) {
        return 'high';
      }
    }

    // Fallback based on other factors
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasHighDPI = window.devicePixelRatio > 1.5;
    
    if (isMobile && !hasHighDPI) return 'low';
    if (isMobile && hasHighDPI) return 'medium';
    
    return 'medium';
  }

  /**
   * Get recommended renderer based on device capabilities
   */
  public static getRecommendedRenderer(): 'webgl' | 'canvas' {
    if (!this.isWebGLSupported()) return 'canvas';
    
    const tier = this.getPerformanceTier();
    return tier === 'low' ? 'canvas' : 'webgl';
  }
}