// Mouse — tracks cursor position and button state
export class Mouse {
  x = 0; y = 0;           // canvas-relative coords
  worldX = 0; worldY = 0; // filled in by camera system

  private _current  = new Set<number>();
  private _previous = new Set<number>();
  private _toAdd    = new Set<number>();
  private _toRemove = new Set<number>();
  private _canvas: HTMLCanvasElement;

  scrollDelta = 0;
  private _rawScroll = 0;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    canvas.addEventListener('mousemove',  this._onMove);
    canvas.addEventListener('mousedown',  this._onDown);
    canvas.addEventListener('mouseup',    this._onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel',      this._onWheel, { passive: true });
  }

  update(): void {
    this._previous = new Set(this._current);
    for (const b of this._toAdd)    this._current.add(b);
    for (const b of this._toRemove) this._current.delete(b);
    this._toAdd.clear();
    this._toRemove.clear();
    this.scrollDelta = this._rawScroll;
    this._rawScroll  = 0;
  }

  isDown    (btn: number) { return this._current.has(btn); }
  isPressed (btn: number) { return  this._current.has(btn) && !this._previous.has(btn); }
  isReleased(btn: number) { return !this._current.has(btn) &&  this._previous.has(btn); }

  get left()   { return this.isDown(0); }
  get middle() { return this.isDown(1); }
  get right()  { return this.isDown(2); }

  private _onMove = (e: MouseEvent): void => {
    const rect = this._canvas.getBoundingClientRect();
    this.x = e.clientX - rect.left;
    this.y = e.clientY - rect.top;
  };
  private _onDown  = (e: MouseEvent): void => { this._toAdd.add(e.button); };
  private _onUp    = (e: MouseEvent): void => { this._toRemove.add(e.button); };
  private _onWheel = (e: WheelEvent): void => { this._rawScroll += e.deltaY; };

  destroy(): void {
    this._canvas.removeEventListener('mousemove', this._onMove);
    this._canvas.removeEventListener('mousedown', this._onDown);
    this._canvas.removeEventListener('mouseup',   this._onUp);
  }
}
