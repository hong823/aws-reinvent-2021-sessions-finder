const { GraphQLClient, gql } = require('graphql-request')

const apiToken = process.env.AWS_REINVENT_API_TOKEN;

async function fetch() {
  const endpoint = 'https://api.us-east-1.prod.events.aws.a2z.com/attendee/graphql'

  const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
      authorization: apiToken,
    },
  })

  const query = gql`
  query ListSessions($input: ListSessionsInput!) {
    listSessions(input: $input) {
      results {
        ...SessionFieldFragment
        isConflicting {
          reserved {
            eventId
            sessionId
            isPaidSession
            __typename
          }
          waitlisted {
            eventId
            sessionId
            isPaidSession
            __typename
          }
          __typename
        }
        __typename
      }
      totalCount
      nextToken
      __typename
    }
  }
  
  fragment SessionFieldFragment on Session {
    action
    alias
    createdAt
    description
    duration
    endTime
    eventId
    isConflicting {
      reserved {
        alias
        createdAt
        eventId
        name
        sessionId
        type
        __typename
      }
      waitlisted {
        alias
        createdAt
        eventId
        name
        sessionId
        type
        __typename
      }
      __typename
    }
    isEmbargoed
    isFavoritedByMe
    isPaidSession
    level
    location
    myReservationStatus
    name
    sessionId
    startTime
    status
    type
    capacities {
      reservableRemaining
      waitlistRemaining
      __typename
    }
    customFieldDetails {
      name
      type
      visibility
      fieldId
      ... on CustomFieldValueFlag {
        enabled
        __typename
      }
      ... on CustomFieldValueSingleSelect {
        value {
          fieldOptionId
          name
          __typename
        }
        __typename
      }
      ... on CustomFieldValueMultiSelect {
        values {
          fieldOptionId
          name
          __typename
        }
        __typename
      }
      ... on CustomFieldValueHyperlink {
        text
        url
        __typename
      }
      __typename
    }
    package {
      itemId
      __typename
    }
    price {
      currency
      value
      __typename
    }
    venue {
      name
      __typename
    }
    room {
      name
      __typename
    }
    sessionType {
      name
      __typename
    }
    tracks {
      name
      __typename
    }
    __typename
  }  
  `
  const size = 500;
  let variables = {
    "input": {
      "eventId": "b84dca69-6995-4e60-bc3f-7bb7a6d170d1",
      "search": "status:published AND isEmbargoed:false AND (isPaidSession:(NOT true))",
    //   "search": `status:published AND isEmbargoed:false AND (dayOfWeek:sunday)`,
    // Architect, Developers, Emerging Tech, InfoSec
    //   "search": `status:published AND isEmbargoed:false AND (dayOfWeek:${fetchDay}) AND (isPaidSession:(NOT true)) AND (customFieldDetails.values.fieldOptionId:05066eac-5548-4996-abd7-c7bef939e9cc OR customFieldDetails.values.fieldOptionId:b9cc31a1-876c-451d-89aa-d8b19c83d069 OR customFieldDetails.values.fieldOptionId:0a9445e9-e45e-4bb8-88fc-4ddfa23c9e06 OR customFieldDetails.values.fieldOptionId:4d0f3bb3-a50e-45a4-bade-e49b8725d9f9)`,
      "maxResults": size,
      "isRawQuery": true,
      "nextToken": null
    }
  }

  let data;
  let sessions = [];

  do {
    console.log(`Loading ${size} sessions...`);
    data = await graphQLClient.request(query, variables);

    // Add token for next request
    variables.input.nextToken = data.listSessions.nextToken;

    sessions = sessions.concat(data.listSessions.results);

    console.log(`Total sessions to load: ${data.listSessions.totalCount}`);
  } while (data.listSessions.nextToken != null)

  console.log(`Loaded ${sessions.length} sessions.`);

  sessions.sort(fieldSorter(['startTime', 'venue']));

  // Filter un-wanted session
  sessions = sessions.filter(function(s){return s.action == 'RESERVABLE';} );

  sessions.forEach(s => {
    const startTime = new Date(s.startTime);
    const endTime = new Date(startTime.getTime() + s.duration * 60000);
    let venueName = "-";

    if (s.venue != null) venueName = s.venue.name;

    let hasConflict = (s.isConflicting.reserved[0] != undefined);
    let conflict = "-";

    if (hasConflict) conflict = s.isConflicting.reserved[0].name

    console.log(`\n##### [${s.action}] ${stringDate(startTime)} - ${stringDate(endTime)}, ${venueName}, [${s.alias}] ${s.name}`);

    if (hasConflict)
        console.log(`       Conflict reserved: ${JSON.stringify(conflict)}`);

    if (!hasConflict)
        console.log(`   !!!!! No conflict !!!!!`);

    if (s.isConflicting.waitlisted[0] != undefined)
        console.log(`       Conflict waitlisted: ${JSON.stringify(s.isConflicting.waitlisted[0].name)}`);
  });
}

function stringDate(time) {
    return time.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
}

function fieldSorter(fields) {
    return function (a, b) {
        return fields
            .map(function (o) {
                var dir = 1;
                if (o[0] === '-') {
                   dir = -1;
                   o=o.substring(1);
                }
                if (a[o] > b[o]) return dir;
                if (a[o] < b[o]) return -(dir);
                return 0;
            })
            .reduce(function firstNonZeroValue (p,n) {
                return p ? p : n;
            }, 0);
    };
}

async function main() {
    await fetch().catch((error) => console.error(error))
}

main()