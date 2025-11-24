export class Pin {
    constructor(
      public readonly id: string,
      public readonly name: string,
      public nodeId: string | null = null
    ) {}
  }
  
  export abstract class Component {
    constructor(
      public readonly id: string,
      public readonly type: string,
      public pins: Pin[]
    ) {}
  
    abstract getModel(): any; // sera utilisé par le solveur
  }
  