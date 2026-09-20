import{user,json,error}from'../shared';
export async function GET(req:Request){try{return json(user(req))}catch(e){return error(e)}}
