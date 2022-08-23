/**

what's in this file: 
In this file you specify a JS module with some callbacks. Basically those callbacks get calls when you receive an event from the vonage backend. There's also a 
special route function that is called on your conversation function start up allowing your to expose new local http endpoint

the event you can interract here are the same you can specify in your application: https://developer.nexmo.com/application/overview

event callbacks for rtc: 
 - rtcEvent (event, context)

event callbacks for anything else (those one are just standard express middleware access req.nexmo to get the context): 

voice callbacks 
 - voiceEvent (req, res, next)
 - voiceAnswer (req, res, next)

messages callbacks (if you specifiy one of thise, you need to declare both of them, those one are just standard express middleware access req.nexmo ):
- messagesInbound (req, res, next)
- messagesStatus (req, res, next)


route(app) // app is an express app




nexmo context: 
you can find this as the second parameter of rtcEvent funciton or as part or the request in req.nexmo in every request received by the handler 
you specify in the route function.

it contains the following: 
const {
        generateBEToken,
        generateUserToken,
        logger,
        csClient,
        storageClient
} = nexmo;

- generateBEToken, generateUserToken,// those methods can generate a valid token for application
- csClient: this is just a wrapper on https://github.com/axios/axios who is already authenticated as a nexmo application and 
    is gonna already log any request/response you do on conversation api. 
    Here is the api spec: https://jurgob.github.io/conversation-service-docs/#/openapiuiv3
- logger: this is an integrated logger, basically a bunyan instance
- storageClient: this is a simple key/value inmemory-storage client based on redis

*/



/** 
 * 
 * This function is meant to handle all the asyncronus event you are gonna receive from conversation api 
 * 
 * it has 2 parameters, event and nexmo context
 * @param {object} event - this is a conversation api event. Find the list of the event here: https://jurgob.github.io/conversation-service-docs/#/customv3
 * @param {object} nexmo - see the context section above
 * */

const DATACENTER = `https://api.nexmo.com`;
const WS_DATACENTER = `https://ws.nexmo.com`;


const path = require("path");

const rtcEvent = async (event, { logger, csClient }) => {

}

const voiceAnswer = async (req, res, next) => {
    const { config } = req.nexmo;


    return res.json([
        { action: 'talk', text: 'Please wait for an agent to answer...' },
        {
            "action": "connect",
            "from": "441143597011",
            "endpoint": [
                {
                    "type": "app",
                    "user": "nathan" // TODO: Need to add some logic randomly pick an available agent 
                }
            ]
        },
        {
            "action": "input",
            "eventUrl": [
              `${config.server_url}/api/mute`
            ],
            "type": [ "speech" ],
            "speech": {
              "context": [ "mute" ]
            }
        }
    ]);
};

const voiceEvent = async (req, res, next) => {
    const { logger, csClient } = req.nexmo;

    try { 
        
        res.json({})

    } catch (err) {
        
        logger.error("Error on voiceEvent function")
    }
    
}

/**
 * 
 * @param {object} app - this is an express app
 * you can register and handler same way you would do in express. 
 * the only difference is that in every req, you will have a req.nexmo variable containning a nexmo context
 * 
 */
const route = (app, express) => {
    app.use(express.static(path.join(__dirname, "public")));
    app.get("/", function (req, res) {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app.post('/api/mute', async (req, res)=>{
        const { csClient, logger } = req.nexmo;
        logger.info({body:req.body}, 'mutting call:');
        
        const legRes = await csClient({
            url:`${DATACENTER}/v0.3/legs/${req.body.uuid}`, 
            method: 'put',
            data:{
                action: 'mute',
            }
        });

        res.json([{action:'talk', text: 'your muted'}]);
    });

    app.get('/api/user/:username', async (req, res) => {
        const { csClient, logger } = req.nexmo;
        const { username } = req.params;
        const display = req.query.display;

        let userHref;

        try {
            const userListRes = await csClient({
                url: `${DATACENTER}/v0.3/users?name=${username}`,
                method: "GET",
            });
            const data = userListRes.data._embedded.users[0];
            userHref = data.id;
        } catch (e) {
            logger.error(e, 'User not found, make new user');
            try {
            const newUser = await csClient({
                url: `${DATACENTER}/v0.3/users`,
                method: 'post',
                data: {
                    name: username,
                    display_name: display ?? username,
                }
            });
            
            userHref = newUser.data.id;
        } catch (err) {
                logger.error(err, 'could not make user');
            }

        } finally {
            const userRes = await csClient({
                url: `${DATACENTER}/beta/users/${userHref}`,
                method: 'GET',
            });
            res.json(userRes.data);
        }


    });

    app.post('/api/auth/login', async (req, res) => {
        const { generateUserToken } = req.nexmo;
        const username = req.body.username;

        console.log(req);

        res.json({
            user: username,
            token: generateUserToken(username),
            csapi: DATACENTER,
            ws: WS_DATACENTER
        });
    });

    app.get('/api/conversation/:conversation_name', async (req, res) => {
        const { csClient } = req.nexmo;
        const { conversation_name } = req.params;
        const display = req.query.display;
        const conversationsRes = await csClient({
            url: `${DATACENTER}/beta2/conversations?name=${conversation_name}`,
            method: 'GET',
        });

        const data = conversationsRes.data._embedded.data;

        if (data.conversations.length < 1) {
            // Make a new conversation
            const newConvo = await csClient({
                url: `${DATACENTER}/beta2/conversations`,
                method: 'POST',
                data: {
                    name: conversation_name,
                    display_name: display ?? conversation_name,
                }
            });

            res.json(newConvo.data);
        } else {
            res.json(data.conversations[0]);
        }

    });


}



module.exports = {
    route,
    voiceAnswer,
    voiceEvent
}
