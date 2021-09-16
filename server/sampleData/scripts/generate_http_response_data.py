# *** GENERATES HTTP RESPONSE SAMPLE DATA FOR ANOMALY DETECTION DASHBOARDS ***

import json
import random

codes = [100, 101, 102, 200, 201, 202, 300,
         301, 302, 400, 403, 404, 500, 501, 502]

# if assuming 1 min gaps are set, then num_docs = 40320.
# 1440 minutes in a day. 40320 = 28 days = 4 weeks = 1 week historical + 3 weeks upcoming
num_docs = 40320

# interval per entity. For example, given 10 entities, there will be 10 docs at t1, 10 docs at t2, etc.
time_interval = 60000

# number of entities to include - will multiply the size of the index by this amount
num_ips = 10
num_endpoints = 5
num_entities = num_ips * num_endpoints


def generateCodes():
    global codes
    # scale rand_range by num_entities so the anomaly sparsity remains similar
    rand_range = 4000 * num_entities
    event_length = 4
    event_counter_4xx = 0
    event_counter_5xx = 0
    cur_4xx = 4
    cur_5xx = 5

    code_list = []
    for i in range(num_docs):
        cur_code = 0

        # get random num and see if it matches 4xx or 5xx
        rand_num = random.randint(0, rand_range)
        random_safe = codes[random.randint(0, 8)]
        # 1/rand_num chance of occurring
        if rand_num is 4:
            # reset the anomaly event counter and set the 4xx
            event_counter_4xx = event_length + random.randint(0, 3)
            cur_4xx = codes[random.randint(9, 11)]
        # 1/rand_num chance of occurring
        if rand_num is 5:
            # reset the anomaly event counter and set the 5xx
            event_counter_5xx = event_length + random.randint(0, 3)
            cur_5xx = codes[random.randint(12, 14)]

        # if there are any anomaly events: increase chances of those codes re-occurring
        if event_counter_4xx > 0 or event_counter_5xx > 0:
            if event_counter_4xx > 0:
                # 80% chance of that 4xx occurring again
                if random.randint(0, 4) is not 0:
                    cur_code = cur_4xx
                else:
                    cur_code = random_safe
                event_counter_4xx -= 1

            if event_counter_5xx > 0:
                # 80% chance of that 5xx occurring again
                if random.randint(0, 4) is not 0:
                    cur_code = cur_5xx
                else:
                    cur_code = random_safe
                event_counter_5xx -= 1
        else:
            cur_code = random_safe

        code_list.append(cur_code)
    return code_list


def getCodeCounts(code):
    global codes
    num_1xx = 0
    num_2xx = 0
    num_3xx = 0
    num_4xx = 0
    num_5xx = 0

    if code in codes[0:3]:
        num_1xx = 1
    elif code in codes[3:6]:
        num_2xx = 1
    elif code in codes[6:9]:
        num_3xx = 1
    elif code in codes[9:12]:
        num_4xx = 1
    elif code in codes[12:15]:
        num_5xx = 1

    return (num_1xx, num_2xx, num_3xx, num_4xx, num_5xx)


def getIpList():
    ips = []
    for i in range(num_ips):
        ips.append(".".join(str(random.randint(0, 255)) for _ in range(4)))
    return ips


def getEndpointList():
    return ["/example/endpoint1", "/example/endpoint2", "/example/endpoint3", "/example/endpoint4", "/example/endpoint5"]


def main():
    global num_docs
    global time_interval
    docs = ''
    ts = 100000     # the first timestamp - the value is trival since it will be converted relative to current time in the plugin

    ip_list = getIpList()
    endpoint_list = getEndpointList()

    # get all codes & store in a 3D matrix [ip][endpoint][timestamp] (1 for each IP & endpoint combination at every timestamp)
    code_lists = []
    for i in range(num_ips):
        endpoint_code_lists = []
        for j in range(num_endpoints):
            endpoint_code_lists.append(generateCodes())
        code_lists.append(endpoint_code_lists)

    # for each timestamp, add an entry for each IP
    for time_index in range(num_docs):
        for ip_index in range(num_ips):
            ip = ip_list[ip_index]
            # get some random endpoints that the given IP hits
            for endpoint_index in range(num_endpoints):
                endpoint = endpoint_list[endpoint_index]
                code = code_lists[ip_index][endpoint_index][time_index]
                (num_1xx, num_2xx, num_3xx, num_4xx, num_5xx) = getCodeCounts(code)
                docs += (json.dumps(
                    {
                        "timestamp": ts,
                        "ip": ip,
                        "endpoint": endpoint,
                        "status_code": str(code),
                        "http_1xx": num_1xx,
                        "http_2xx": num_2xx,
                        "http_3xx": num_3xx,
                        "http_4xx": num_4xx,
                        "http_5xx": num_5xx
                    }
                ) + "\n")

        # bump to next timestamp
        ts += time_interval

    docs = docs[:-1]
    print(docs)

    file = open('httpResponses.json', 'w')
    n = file.write(docs)
    file.close()


if __name__ == '__main__':
    main()
