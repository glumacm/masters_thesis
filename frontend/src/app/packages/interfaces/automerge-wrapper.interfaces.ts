export interface CustomChangeI {
    // {"value":5,"op":"replace","path":"/key1/0"},
    value: any;
    op: string; // replace | add | remove | ...
    path: string;

}