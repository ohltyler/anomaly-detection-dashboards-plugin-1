# *** GENERATES ECOMMERCE SAMPLE DATA FOR ANOMALY DETECTION KIBANA ***

import json
import random

randRange = 5000
outage_length = 4
outage_counter = 0

lucky_failure = 5


def failure():
    global randRange
    global outage_length
    global outage_counter
    global lucky_failure

    # get random num and see if it matches lucky failure num
    rand_num = random.randint(0, randRange)

    # now check for outages, and update vars if a new outage has started,
    # or an existing outage is continuing
    if rand_num is lucky_failure:
        outage_counter = outage_length + random.randint(0, 3)
        return True

    # if there are any outages: increase chances of those codes re-occurring
    if outage_counter > 0:
        outage_counter -= 1
        # 80% chance of failure occurring again
        return random.randint(0, 4) is not 1


def getNumItemsPurchased():
    randomNum = random.randint(1, 6)

    # 3/6 chance 1 item, 2/6 2 items, 1/6 3-6 items
    if randomNum < 4:
        return 1
    if randomNum < 6:
        return 2
    return random.randint(3, 6)


def getRevenue():
    # have small chance of purchasing a single super expensive item
    revenue = 0
    if random.randint(0, 5000) is 5:
        revenue = random.randint(2000, 5000)
    else:
        revenue = random.randint(50, 100)

    return revenue - (random.randint(0, 99) / 100.0)


def main():
    # if assuming 1 min gaps are set, then num_docs = 40320.
    # 1440 minutes in a day. 40320 = 28 days = 4 weeks = 1 week historical + 3 weeks upcoming
    num_docs = 40320
    spacing = 60000     # 1 min gaps
    delta = spacing / 2
    docs = ''
    ts = 100000         # arbitrary; will be converted relative to current time
    order_id = 1

    for x in range(0, num_docs):

        numItemsPurchased = getNumItemsPurchased()
        success_count = numItemsPurchased
        failure_count = 0
        revenue = getRevenue()

        if failure():
            success_count = 0
            failure_count = numItemsPurchased
            revenue = 0

        doc = r'{"timestamp": ' + \
            str(ts) + r', "order_id": ' + str(order_id) + \
            r', "items_purchased_success": ' + str(success_count) + \
            r', "items_purchased_failure": ' + str(failure_count) + \
            r', "total_revenue_usd": ' + "{:.2f}".format(revenue) + r'}' + '\n'

        # increment timestamp and order id, and add new doc to string
        order_id += 1
        # add some randomness to timestamp
        ts += (spacing + random.randint(-delta, delta))
        docs += doc

    docs = docs[:-1]

    print('docs:')
    print(docs)

    file = open('ecommerce.json', 'w')
    n = file.write(docs)
    file.close()


if __name__ == '__main__':
    main()
