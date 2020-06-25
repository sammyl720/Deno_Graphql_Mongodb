import { Application } from "https://deno.land/x/oak/mod.ts";
import { applyGraphQL, gql } from "https://deno.land/x/oak_graphql/mod.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.8.0/mod.ts";
import "https://deno.land/x/dotenv/load.ts";

const URI = Deno.env.get('MONGO_URI') || ''
const client = new MongoClient();
client.connectWithUri(URI);

try {

    const db = client.database("test");
    const dogs = db.collection("dogs");
    const app = new Application();
    
    app.use(async (ctx, next) => {
      await next();
      const rt = ctx.response.headers.get("X-Response-Time");
      console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
    });
    
    app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      ctx.response.headers.set("X-Response-Time", `${ms}ms`);
    });
    
    const typeDefs = `
      type Dog {
        name: String!
        isGoodBoi: Boolean!
        id: ID!
      }
    
      input DogInput {
        name: String!
        isGoodBoi: Boolean!
      }
      type Query {
        foo: String!
        dog: [Dog!]
      }
    
      type Mutation {
        addDog(input: DogInput):Dog!
      }
    `
    
    const resolvers = {
      Query: {
        foo: () => 'bar',
        dog: async () => {
          const doggos = await dogs.find()
          return doggos.map(( doggo: any)=> {
            const { _id: {"\$oid": id }} = doggo
            doggo.id = id
            return doggo
          })
        }
      },
      Mutation: {
        addDog: async (_: any, { input: { name, isGoodBoi }}: any, context: any, info: any) => {
          const { "\$oid": id} = await dogs.insertOne({ name, isGoodBoi})
          return { name, isGoodBoi, id }
        }
      }
    }
    
    const GraphqlService = await applyGraphQL({
      typeDefs,
      resolvers
    })
    
    app.use(GraphqlService.routes(), GraphqlService.allowedMethods())
    
    const port = 8000
    
    console.log(`Server started on http://localhost:${port}`)
    await app.listen({ port })
} catch (err) {
  console.log(err)
}