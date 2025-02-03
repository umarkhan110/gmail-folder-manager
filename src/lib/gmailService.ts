// import { google } from "googleapis";
// import { getServerSession } from "next-auth";
// import { authOptions } from "./auth";


// export async function createGmailWatch() {

//   const session = await getServerSession(authOptions);
//   if (!session?.accessToken) {
//     return;
//   }

//   const auth = new google.auth.OAuth2();
//   auth.setCredentials({ access_token: session.accessToken });

//   const gmail = google.gmail({ version: "v1", auth });
//   const requestBody = {
//     topicName: "projects/YOUR_PROJECT_ID/topics/gmail-notifications",
//     labelIds: ["INBOX"],
//   };

//   const response = await gmail.users.watch({
//     userId: "me",
//     requestBody,
//   });

//   console.log("Gmail Watch Response:", response.data);
// }
