declare module 'better-sqlite3' {
  interface Options {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: Function;
  }

  interface Statement {
    run(...params: any[]): Database.RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
    iterate(...params: any[]): IterableIterator<any>;
    pluck(toggle: boolean): Statement;
    expand(toggle: boolean): Statement;
    raw(toggle: boolean): Statement;
    bind(...params: any[]): Statement;
  }

  interface Transaction {
    (...args: any[]): any;
    immediate(...args: any[]): any;
  }

  interface Database {
    prepare(sql: string): Statement;
    transaction(fn: Function): Transaction;
    transaction(fn: Function, options: { type: 'deferred' | 'immediate' | 'exclusive' }): Transaction;
    exec(sql: string): Database;
    pragma(pragma: string, simplify?: boolean): any;
    close(): void;
    open: boolean;
    inTransaction: boolean;
    name: string;
    readonly: boolean;
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  class Database {
    constructor(filename: string, options?: Options);
    prepare(sql: string): Statement;
    transaction(fn: Function): Transaction;
    exec(sql: string): Database;
    pragma(pragma: string, simplify?: boolean): any;
    close(): void;
  }
  
  export default Database;
  export { Database, Options, Statement, Transaction, RunResult };
}
