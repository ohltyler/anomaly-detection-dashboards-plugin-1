# *** GENERATES HOST HEALTH SAMPLE DATA FOR ANOMALY DETECTION KIBANA ***

import json
import random

randRange = 4500
outage_length = 4
outage_counter_cpu = 0
outage_counter_memory = 0

# lucky_cpu = random.randint(0, randRange)
# lucky_memory = random.randint(0, randRange)
lucky_cpu = 5
lucky_memory = 10

cur_cpu = 0
cur_memory = 0


def getNewPercentages():
    global randRange
    global outage_length
    global lucky_cpu
    global lucky_memory
    global outage_counter_cpu
    global outage_counter_memory
    global cur_cpu
    global cur_memory

    # get random num and see if it matches lucky cpu or memory
    rand_num = random.randint(0, randRange)

    # set to similar values in the safe range
    cur_cpu = getSimilarVal(cur_cpu, 25, 35)
    cur_memory = getSimilarVal(cur_memory, 45, 55)

    # now check for outages, and update vars if a new outage has started,
    # or an existing outage is continuing
    if rand_num is lucky_cpu:
        outage_counter_cpu = outage_length + random.randint(0, 3)
        cur_cpu = 90 + random.randint(0, 10)
    if rand_num is lucky_memory:
        outage_counter_memory = outage_length + random.randint(0, 3)
        cur_memory = 90 + random.randint(0, 10)

    # if there are any outages: increase chances of those codes re-occurring
    if outage_counter_cpu > 0 or outage_counter_memory > 0:
        # if cpu not done with outage:
        if outage_counter_cpu > 0:
            # 80% chance of that high percentage occurring again
            if random.randint(0, 4) is not 0:
                if cur_cpu >= 90:
                    cur_cpu = getSimilarVal(cur_cpu, 90, 100)
                else:
                    cur_cpu = 90 + random.randint(0, 10)
            else:
                cur_cpu = getSimilarVal(80, 70, 90)
            outage_counter_cpu -= 1

        # if memory not done with outage:
        if outage_counter_memory > 0:
            # 80% chance of that high percentage occurring again
            if random.randint(0, 4) is not 0:
                if cur_memory >= 90:
                    cur_memory = getSimilarVal(cur_memory, 90, 100)
                else:
                    cur_memory = 90 + random.randint(0, 10)
            else:
                cur_memory = getSimilarVal(85, 80, 90)
            outage_counter_memory -= 1


def getSimilarVal(val, lowLimit, highLimit):
    valToTry = val + random.randint(-3, 3)
    if valToTry > highLimit:
        return highLimit - random.randint(0, 2)
    if valToTry < lowLimit:
        return lowLimit + random.randint(0, 2)
    return valToTry


def main():
    # if assuming 1 min gaps are set, then num_docs = 40320.
    # 1440 minutes in a day. 40320 = 28 days = 4 weeks = 1 week historical + 3 weeks upcoming
    num_docs = 40320
    spacing = 60000     # 1 min gaps
    docs = ''
    ts = 100000         # arbitrary; will be converted relative to current time

    for x in range(0, num_docs):

        getNewPercentages()

        doc = r'{"timestamp": ' + \
            str(ts) + r', "cpu_usage_percentage": ' + str(cur_cpu) + \
            r', "memory_usage_percentage": ' + str(cur_memory) + r'}' + '\n'

        # increment timestamp and add new doc to string
        ts += spacing
        docs += doc

    docs = docs[:-1]

    print('docs:')
    print(docs)

    file = open('hostHealth.json', 'w')
    n = file.write(docs)
    file.close()


if __name__ == '__main__':
    main()
