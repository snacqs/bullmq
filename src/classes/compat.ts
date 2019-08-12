// Type definitions for bull 3.10
// Project: https://github.com/OptimalBits/bull
// Definitions by: Bruno Grieder <https://github.com/bgrieder>
//                 Cameron Crothers <https://github.com/JProgrammer>
//                 Marshall Cottrell <https://github.com/marshall007>
//                 Weeco <https://github.com/weeco>
//                 Gabriel Terwesten <https://github.com/blaugold>
//                 Oleg Repin <https://github.com/iamolegga>
//                 David Koblas <https://github.com/koblas>
//                 Bond Akinmade <https://github.com/bondz>
//                 Wuha Team <https://github.com/wuha-team>
//                 Alec Brunelle <https://github.com/aleccool213>
//                 Dan Manastireanu <https://github.com/danmana>
//                 Kjell-Morten Bratsberg Thorsen <https://github.com/kjellmorten>
//                 Christian D. <https://github.com/pc-jedi>
//                 Silas Rech <https://github.com/lenovouser>
//                 DoYoung Ha <https://github.com/hados99>
//                 Borys Kupar <https://github.com/borys-kupar>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.8

import IORedis from "ioredis";
import { EventEmitter } from "events";
import {
  QueueEvents as V4QueueEvents,
  Worker as V4Worker,
  Queue as V4Queue,
  Job as V4Job,
} from '@src/classes';
import {
  ClientType as V4ClientType,
  JobsOpts as V4JobsOpts,
  QueueOptions as V4QueueOptions,
  QueueBaseOptions as V4QueueBaseOptions,
  AdvancedOpts as V4AdvancedOpts,
  BackoffOpts as V4BackoffOpts,
  RateLimiterOpts as V4RateLimiterOpts,
  RepeatOpts as V4RepeatOpts,
  QueueEventsOptions as V4QueueEventsOptions,
  WorkerOptions as V4WorkerOptions,
  Processor as V4Processor,
} from '@src/interfaces';
import {
  JobJson as V4JobJson,
} from '@src/classes';
import _ from 'lodash';
import url from "url";

export default class Queue<T = any> extends EventEmitter {

  static readonly DEFAULT_JOB_NAME = "__default__";

  /**
   * The name of the queue
   */
  name: string;

  /**
   * Queue client (used to add jobs, pause queues, etc);
   */
  client: IORedis.Redis;

  /**
   * Array of Redis clients the queue uses
   */
  clients: IORedis.Redis[];

  private opts: QueueOptions;
  private keyPrefix: string;

  private v4Queue: V4Queue;
  private v4QueueEvents: V4QueueEvents;
  private v4Worker: V4Worker;
  private handlers: { [key:string]: Function };

  /**
   * This is the Queue constructor.
   * It creates a new Queue that is persisted in Redis.
   * Everytime the same queue is instantiated it tries to process all the old jobs that may exist from a previous unfinished session.
   */
  constructor(queueName: string, opts?: QueueOptions);
  constructor(queueName: string, url: string, opts?: QueueOptions);

  constructor(queueName: string, arg2?: any, arg3?: any) {
    super();

    Object.defineProperties(this, {
      v4Queue: {
        enumerable: false,
        writable: true
      },
      v4QueueEvents: {
        enumerable: false,
        writable: true
      },
      v4Worker: {
        enumerable: false,
        writable: true
      },
      client: {
        // TODO
      },
      clients: {
        // TODO
      },
      toKey: {
        get: () => { return this.getV4Queue().toKey; }
      }
    });

    let opts: QueueOptions;

    if (_.isString(arg2)) {
      opts = _.extend(
        {},
        {
          redis: Utils.redisOptsFromUrl(arg2)
        },
        arg3
      );
    } else {
      opts = arg2;
    }

    this.opts = opts;
    this.name = queueName;

    this.keyPrefix = opts.redis.keyPrefix || opts.prefix || 'bull';

    //
    // We cannot use ioredis keyPrefix feature since we
    // create keys dynamically in lua scripts.
    //
    delete opts.redis.keyPrefix;
  }

  /**
   * Returns a promise that resolves when Redis is connected and the queue is ready to accept jobs.
   * This replaces the `ready` event emitted on Queue in previous verisons.
   */
  async isReady(): Promise<this> {
    await this.getV4Queue().waitUntilReady();
    return this;
  };

  /* tslint:disable:unified-signatures */

  /**
   * Defines a processing function for the jobs placed into a given Queue.
   *
   * The callback is called everytime a job is placed in the queue.
   * It is passed an instance of the job as first argument.
   *
   * If the callback signature contains the second optional done argument,
   * the callback will be passed a done callback to be called after the job has been completed.
   * The done callback can be called with an Error instance, to signal that the job did not complete successfully,
   * or with a result as second argument (e.g.: done(null, result);) when the job is successful.
   * Errors will be passed as a second argument to the "failed" event; results, as a second argument to the "completed" event.
   *
   * If, however, the callback signature does not contain the done argument,
   * a promise must be returned to signal job completion.
   * If the promise is rejected, the error will be passed as a second argument to the "failed" event.
   * If it is resolved, its value will be the "completed" event's second argument.
   */
  process(callback: ProcessCallbackFunction<T>): Promise<void>;
  process(callback: ProcessPromiseFunction<T>): Promise<void>;
  process(callback: string): Promise<void>;

  /**
   * Defines a processing function for the jobs placed into a given Queue.
   *
   * The callback is called everytime a job is placed in the queue.
   * It is passed an instance of the job as first argument.
   *
   * If the callback signature contains the second optional done argument,
   * the callback will be passed a done callback to be called after the job has been completed.
   * The done callback can be called with an Error instance, to signal that the job did not complete successfully,
   * or with a result as second argument (e.g.: done(null, result);) when the job is successful.
   * Errors will be passed as a second argument to the "failed" event; results, as a second argument to the "completed" event.
   *
   * If, however, the callback signature does not contain the done argument,
   * a promise must be returned to signal job completion.
   * If the promise is rejected, the error will be passed as a second argument to the "failed" event.
   * If it is resolved, its value will be the "completed" event's second argument.
   *
   * @param concurrency Bull will then call your handler in parallel respecting this maximum value.
   */
  process(concurrency: number, callback: ProcessCallbackFunction<T>): Promise<void>;
  process(concurrency: number, callback: ProcessPromiseFunction<T>): Promise<void>;
  process(concurrency: number, callback: string): Promise<void>;

  /**
   * Defines a processing function for the jobs placed into a given Queue.
   *
   * The callback is called everytime a job is placed in the queue.
   * It is passed an instance of the job as first argument.
   *
   * If the callback signature contains the second optional done argument,
   * the callback will be passed a done callback to be called after the job has been completed.
   * The done callback can be called with an Error instance, to signal that the job did not complete successfully,
   * or with a result as second argument (e.g.: done(null, result);) when the job is successful.
   * Errors will be passed as a second argument to the "failed" event; results, as a second argument to the "completed" event.
   *
   * If, however, the callback signature does not contain the done argument,
   * a promise must be returned to signal job completion.
   * If the promise is rejected, the error will be passed as a second argument to the "failed" event.
   * If it is resolved, its value will be the "completed" event's second argument.
   *
   * @param name Bull will only call the handler if the job name matches
   */
  process(name: string, callback: ProcessCallbackFunction<T>): Promise<void>;
  process(name: string, callback: ProcessPromiseFunction<T>): Promise<void>;
  process(name: string, callback: string): Promise<void>;

  /**
   * Defines a processing function for the jobs placed into a given Queue.
   *
   * The callback is called everytime a job is placed in the queue.
   * It is passed an instance of the job as first argument.
   *
   * If the callback signature contains the second optional done argument,
   * the callback will be passed a done callback to be called after the job has been completed.
   * The done callback can be called with an Error instance, to signal that the job did not complete successfully,
   * or with a result as second argument (e.g.: done(null, result);) when the job is successful.
   * Errors will be passed as a second argument to the "failed" event; results, as a second argument to the "completed" event.
   *
   * If, however, the callback signature does not contain the done argument,
   * a promise must be returned to signal job completion.
   * If the promise is rejected, the error will be passed as a second argument to the "failed" event.
   * If it is resolved, its value will be the "completed" event's second argument.
   *
   * @param name Bull will only call the handler if the job name matches
   * @param concurrency Bull will then call your handler in parallel respecting this maximum value.
   */
  process(name: string, concurrency: number, callback: ProcessCallbackFunction<T>): Promise<void>;
  process(name: string, concurrency: number, callback: ProcessPromiseFunction<T>): Promise<void>;
  process(name: string, concurrency: number, callback: string): Promise<void>;

  process(arg1: any, arg2?: any, arg3?: any): Promise<void> {
    let name: string = Queue.DEFAULT_JOB_NAME;
    let concurrency: number = 1;
    let handler: Function;
    let handlerFile: string;

    if(arguments.length === 1) {
      if(typeof arg1 === "function") {
        handler = arg1;
      } else if(typeof arg1 === "string") {
        handlerFile = arg1;
      }
    }
    else if(arguments.length === 2) {
      if(typeof arg1 === "number") {
        concurrency = arg1 > 0 ? arg1 : 1;
      } else if(typeof arg1 === "string") {
        name = arg1;
      }
      if(typeof arg2 === "function") {
        handler = arg2;
      } else if(typeof arg2 === "string") {
        handlerFile = arg2;
      }
    }
    else if(arguments.length === 3) {
      if(typeof arg1 === "string") {
        name = arg1;
      }
      if(typeof arg2 === "number") {
        concurrency = arg2 > 0 ? arg2 : 1;
      }
      if(typeof arg3 === "function") {
        handler = arg3;
      } else if(typeof arg3 === "string") {
        handlerFile = arg3;
      }
    }

    if (!handler && !handlerFile) {
      throw new Error('Cannot set an undefined handler');
    }
    if (this.handlers[name]) {
      throw new Error('Cannot define the same handler twice ' + name);
    }

    if(handlerFile && name !== Queue.DEFAULT_JOB_NAME) {
      throw new Error('Named processors are not supported with sandboxed workers');
    }

    this.handlers[name] = handler;

    if(! this.v4Worker) {
      const workerOpts = Utils.convertToV4WorkerOptions(this.opts);
      workerOpts.concurrency = concurrency;
      if(handlerFile) {
        this.v4Worker = new V4Worker(this.name, handlerFile, workerOpts);
      } else {
        this.v4Worker = new V4Worker(this.name, this.createProcessor(), workerOpts);
      }
    }
    return this.v4Worker.waitUntilReady();
  }

  /* tslint:enable:unified-signatures */

  /**
   * Creates a new job and adds it to the queue.
   * If the queue is empty the job will be executed directly,
   * otherwise it will be placed in the queue and executed as soon as possible.
   */
  add(data: T, opts?: JobOptions): Promise<Job<T>>;

  /**
   * Creates a new named job and adds it to the queue.
   * If the queue is empty the job will be executed directly,
   * otherwise it will be placed in the queue and executed as soon as possible.
   */
  add(name: string, data: T, opts?: JobOptions): Promise<Job<T>>;

  async add(arg1: any, arg2?: any, arg3?: any): Promise<Job<T>> {
    let name: string = Queue.DEFAULT_JOB_NAME;
    let data: any;
    let opts: JobOptions = {};

    if (typeof arg1 === 'string') {
      name = arg1 || Queue.DEFAULT_JOB_NAME;
      data = arg2;
      opts = arg3 || {};
    } else {
      data = arg1;
      opts = arg2 || {};
    }

    if (opts.repeat) {
      const result = await this.getV4Queue().repeat.addNextRepeatableJob(
        name, data,
        Utils.convertToV4JobsOpts(opts),
        (opts.repeat as any).jobId,
        true
      );
      return Utils.convertToJob(result, this);
    } else {
      const result = await this.getV4Queue().append(name, data, Utils.convertToV4JobsOpts(opts));
      return Utils.convertToJob(result, this);
    }
  }

  /**
   * Returns a promise that resolves when the queue is paused.
   *
   * A paused queue will not process new jobs until resumed, but current jobs being processed will continue until
   * they are finalized. The pause can be either global or local. If global, all workers in all queue instances
   * for a given queue will be paused. If local, just this worker will stop processing new jobs after the current
   * lock expires. This can be useful to stop a worker from taking new jobs prior to shutting down.
   *
   * Pausing a queue that is already paused does nothing.
   */
  async pause(isLocal?: boolean): Promise<void> {
    if(isLocal) {
      return this.v4Worker && this.v4Worker.pause(true);
    } else {
      return this.v4Queue && this.v4Queue.pause();
    }
  }

  /**
   * Returns a promise that resolves when the queue is resumed after being paused.
   *
   * The resume can be either local or global. If global, all workers in all queue instances for a given queue
   * will be resumed. If local, only this worker will be resumed. Note that resuming a queue globally will not
   * resume workers that have been paused locally; for those, resume(true) must be called directly on their
   * instances.
   *
   * Resuming a queue that is not paused does nothing.
   */
  async resume(isLocal?: boolean): Promise<void>{
    if(isLocal) {
      return this.v4Worker && this.v4Worker.resume();
    } else {
      return this.v4Queue && this.v4Queue.resume();
    }
  }


  /**
   * Returns a promise that returns the number of jobs in the queue, waiting or paused.
   * Since there may be other processes adding or processing jobs, this value may be true only for a very small amount of time.
   */
  count(): Promise<number>{
    return this.getV4Queue().count();
  }


  /**
   * Empties a queue deleting all the input lists and associated jobs.
   */
  empty(): Promise<void>{
    throw new Error('Not supported');
  }


  /**
   * Closes the underlying redis client. Use this to perform a graceful shutdown.
   *
   * `close` can be called from anywhere, with one caveat:
   * if called from within a job handler the queue won't close until after the job has been processed
   */
  close(): Promise<any> {
    const promises = [];

    if(this.v4Queue) {
      promises.push(this.v4Queue.close());
    }
    if(this.v4QueueEvents) {
      promises.push(this.v4QueueEvents.close());
    }
    if(this.v4Worker) {
      promises.push(this.v4Worker.close());
    }
    return Promise.all(promises);
  }


  /**
   * Returns a promise that will return the job instance associated with the jobId parameter.
   * If the specified job cannot be located, the promise callback parameter will be set to null.
   */
  async getJob(jobId: JobId): Promise<Job<T> | null>{
    const job = await this.getV4Queue().getJob(Utils.convertToV4JobId(jobId));
    return Utils.convertToJob(job, this);
  }


  /**
   * Returns a promise that will return an array with the waiting jobs between start and end.
   */
  async getWaiting(start: number = 0, end: number = -1): Promise<Array<Job<T>>>{
    const result: V4Job[] = await this.getV4Queue().getWaiting(start, end);
    return result.map(job => Utils.convertToJob(job, this));
  }


  /**
   * Returns a promise that will return an array with the active jobs between start and end.
   */
  async getActive(start: number = 0, end: number = -1): Promise<Array<Job<T>>>{
    const result: V4Job[] = await this.getV4Queue().getActive(start, end);
    return result.map(job => Utils.convertToJob(job, this));
  }


  /**
   * Returns a promise that will return an array with the delayed jobs between start and end.
   */
  async getDelayed(start: number = 0, end: number = -1): Promise<Array<Job<T>>>{
    const result: V4Job[] = await this.getV4Queue().getDelayed(start, end);
    return result.map(job => Utils.convertToJob(job, this));
  }


  /**
   * Returns a promise that will return an array with the completed jobs between start and end.
   */
  async getCompleted(start: number = 0, end: number = -1): Promise<Array<Job<T>>>{
    const result: V4Job[] = await this.getV4Queue().getCompleted(start, end);
    return result.map(job => Utils.convertToJob(job, this));
  }


  /**
   * Returns a promise that will return an array with the failed jobs between start and end.
   */
  async getFailed(start: number = 0, end: number = -1): Promise<Array<Job<T>>>{
    const result: V4Job[] = await this.getV4Queue().getFailed(start, end);
    return result.map(job => Utils.convertToJob(job, this));
  }


  /**
   * Returns JobInformation of repeatable jobs (ordered descending). Provide a start and/or an end
   * index to limit the number of results. Start defaults to 0, end to -1 and asc to false.
   */
  getRepeatableJobs(start: number = 0, end: number = -1, asc: boolean = false): Promise<JobInformation[]>{
    return this.getV4Queue().repeat.getRepeatableJobs(start, end, asc);
  }


  /**
   * ???
   */
  async nextRepeatableJob(name: string, data: any, opts: JobOptions, skipCheckExists?: boolean): Promise<Job<T>>{
    const result = await this.getV4Queue().repeat.addNextRepeatableJob(
      name || Queue.DEFAULT_JOB_NAME,
      data,
      Utils.convertToV4JobsOpts(opts),
      (opts.repeat as any).jobId,
      skipCheckExists
    );
    return Utils.convertToJob(result, this);
  }


  /**
   * Removes a given repeatable job. The RepeatOptions and JobId needs to be the same as the ones
   * used for the job when it was added.
   */
  removeRepeatable(repeat: (CronRepeatOptions | EveryRepeatOptions) & { jobId?: JobId }): Promise<void>

  /**
   * Removes a given repeatable job. The RepeatOptions and JobId needs to be the same as the ones
   * used for the job when it was added.
   *
   * name: The name of the to be removed job
   */
  removeRepeatable(name: string, repeat: (CronRepeatOptions | EveryRepeatOptions) & { jobId?: JobId }): Promise<void>;

  async removeRepeatable(arg1: any, arg2?: any): Promise<void> {
    let name: string = Queue.DEFAULT_JOB_NAME;
    let repeat: (CronRepeatOptions | EveryRepeatOptions) & { jobId?: JobId };

    if(typeof arg1 === 'string') {
      name = arg1;
      repeat = arg2;
    } else {
      repeat = arg1;
    }
    return this.getV4Queue().repeat.removeRepeatable(name,
      Utils.convertToV4RepeatOpts(repeat), Utils.convertToV4JobId(repeat.jobId))
  }

  /**
   * Removes a given repeatable job by key.
   */
  async removeRepeatableByKey(repeatJobKey: string): Promise<void> {
    const repeat = this.getV4Queue().repeat;
    await repeat.waitUntilReady();

    const tokens = repeatJobKey.split(':');
    const data = {
      key: repeatJobKey,
      name: tokens[0],
      id: tokens[1] || null,
      endDate: parseInt(tokens[2]) || null,
      tz: tokens[3] || null,
      cron: tokens[4]
    };

    const queueKey = repeat.toKey('');
    return (<any>repeat.client).removeRepeatable(
      repeat.keys.repeat,
      repeat.keys.delayed,
      data.id,
      repeatJobKey,
      queueKey
    );
  }

  /**
   * Returns a promise that will return an array of job instances of the given types.
   * Optional parameters for range and ordering are provided.
   */
  async getJobs(types: string[], start: number = 0, end: number = -1, asc: boolean = false): Promise<Array<Job<T>>> {
    const result: V4Job[] = await this.getV4Queue().getJobs(types, start, end, asc);
    return result.map(job => Utils.convertToJob(job, this));
  }

  /**
   * Returns a object with the logs according to the start and end arguments. The returned count
   * value is the total amount of logs, useful for implementing pagination.
   */
  getJobLogs(jobId: string, start: number = 0, end: number = -1): Promise<{ logs: string[], count: number }> {
    throw new Error('Not supported');
  }

  /**
   * Returns a promise that resolves with the job counts for the given queue.
   */
  async getJobCounts(): Promise<JobCounts> {
    const result = await this.getV4Queue().getJobCounts();
    return Utils.convertToJobCounts(result);
  }

  /**
   * Returns a promise that resolves with the job counts for the given queue of the given types.
   */
  async getJobCountByTypes(types: string[] | string): Promise<number> {
    return this.getV4Queue().getJobCountByTypes(...types);
  }

  /**
   * Returns a promise that resolves with the quantity of completed jobs.
   */
  getCompletedCount(): Promise<number> {
    return this.getV4Queue().getCompletedCount();
  }

  /**
   * Returns a promise that resolves with the quantity of failed jobs.
   */
  getFailedCount(): Promise<number> {
    return this.getV4Queue().getFailedCount();
  }

  /**
   * Returns a promise that resolves with the quantity of delayed jobs.
   */
  getDelayedCount(): Promise<number> {
    return this.getV4Queue().getDelayedCount();
  }

  /**
   * Returns a promise that resolves with the quantity of waiting jobs.
   */
  getWaitingCount(): Promise<number> {
    return this.getV4Queue().getWaitingCount();
  }

  /**
   * Returns a promise that resolves with the quantity of paused jobs.
   */
  getPausedCount(): Promise<number> {
    return this.getV4Queue().getJobCountByTypes('paused');
  }

  /**
   * Returns a promise that resolves with the quantity of active jobs.
   */
  getActiveCount(): Promise<number> {
    return this.getV4Queue().getActiveCount();
  }

  /**
   * Returns a promise that resolves to the quantity of repeatable jobs.
   */
  getRepeatableCount(): Promise<number> {
    return this.getV4Queue().repeat.getRepeatableCount();
  }

  /**
   * Tells the queue remove all jobs created outside of a grace period in milliseconds.
   * You can clean the jobs with the following states: completed, wait (typo for waiting), active, delayed, and failed.
   * @param grace Grace period in milliseconds.
   * @param status Status of the job to clean. Values are completed, wait, active, delayed, and failed. Defaults to completed.
   * @param limit Maximum amount of jobs to clean per call. If not provided will clean all matching jobs.
   */
  clean(grace: number, status?: JobStatusClean, limit?: number): Promise<Array<Job<T>>> {
    throw new Error('Not supported');
  }

  /**
   * Listens to queue events
   */
  on(event: string, callback: (...args: any[]) => void): this;

  /**
   * An error occured
   */
  on(event: 'error', callback: ErrorEventCallback): this;

  /**
   * A Job is waiting to be processed as soon as a worker is idling.
   */
  on(event: 'waiting', callback: WaitingEventCallback): this;

  /**
   * A job has started. You can use `jobPromise.cancel()` to abort it
   */
  on(event: 'active', callback: ActiveEventCallback<T>): this;

  /**
   * A job has been marked as stalled.
   * This is useful for debugging job workers that crash or pause the event loop.
   */
  on(event: 'stalled', callback: StalledEventCallback<T>): this;

  /**
   * A job's progress was updated
   */
  on(event: 'progress', callback: ProgressEventCallback<T>): this;

  /**
   * A job successfully completed with a `result`
   */
  on(event: 'completed', callback: CompletedEventCallback<T>): this;

  /**
   * A job failed with `err` as the reason
   */
  on(event: 'failed', callback: FailedEventCallback<T>): this;

  /**
   * The queue has been paused
   */
  on(event: 'paused', callback: EventCallback): this;

  /**
   * The queue has been resumed
   */
  on(event: 'resumed', callback: EventCallback): this; // tslint:disable-line unified-signatures

  /**
   * A job successfully removed.
   */
  on(event: 'removed', callback: RemovedEventCallback<T>): this;

  /**
   * Old jobs have been cleaned from the queue.
   * `jobs` is an array of jobs that were removed, and `type` is the type of those jobs.
   *
   * @see Queue#clean() for details
   */
  on(event: 'cleaned', callback: CleanedEventCallback<T>): this;

  /**
   * Emitted every time the queue has processed all the waiting jobs
   * (even if there can be some delayed jobs not yet processed)
   */
  on(event: 'drained', callback: EventCallback): this; // tslint:disable-line unified-signatures

  on(event: string, callback: Function): this {
    throw new Error('Not supported');
  }

  /**
   * Set clientName to Redis.client
   */
  setWorkerName(): Promise<any> {
    throw new Error('Not supported');
  }

  /**
   * Returns Redis clients array which belongs to current Queue
   */
  getWorkers(): Promise<{[key: string]: string }[]> {
    return this.getV4Queue().getWorkers();
  }

  /**
   * Returns Queue name in base64 encoded format
   */
  base64Name(): string {
    return (this.getV4Queue() as any).base64Name();
  };

  /**
   * Returns Queue name with keyPrefix (default: 'bull')
   */
  clientName(): string {
    return (this.getV4Queue() as any).clientName();
  };

  /**
   * Returns Redis clients array which belongs to current Queue from string with all redis clients
   *
   * @param list String with all redis clients
   */
  parseClientList(list: string): {[key: string]: string }[] {
    return (this.getV4Queue() as any).parseClientList(list);
  };

  private getV4Queue() {
    if (! this.v4Queue) {
      this.v4Queue = new V4Queue(this.name, Utils.convertToV4QueueOptions(this.opts));
    }
    return this.v4Queue;
  }

  private getV4QueueEvents() {
    if (! this.v4QueueEvents) {
      this.v4QueueEvents = new V4QueueEvents(this.name, Utils.convertToV4QueueEventsOptions(this.opts));
    }
    return this.v4QueueEvents;
  }

  private createProcessor(): V4Processor {
    const handlers = this.handlers;

    return (job: V4Job): Promise<any> => {
      const name = job.name || Queue.DEFAULT_JOB_NAME;
      const handler = handlers[name] || handlers['*'];
      if(! handler) {
        throw new Error('Missing process handler for job type ' + name);
      }

      return new Promise((resolve, reject) => {
        if (handler.length > 1) {
          const done = (err: any, res: any) => {
            if(err) {
              reject(err);
            }
            resolve(res);
          };
          handler.apply(null, [Utils.convertToJob(job, this), done]);
        } else {
          try {
            return resolve(handler.apply(null, [Utils.convertToJob(job, this)]));
          } catch (err) {
            return reject(err);
          }
        }
      });
    };
  }

}

export class Job<T = any> {

  id: JobId;

  /**
   * The custom data passed when the job was created
   */
  data: T;

  /**
   * Options of the job
   */
  opts: JobOptions;

  /**
   * How many attempts where made to run this job
   */
  attemptsMade: number;

  /**
   * When this job was started (unix milliseconds)
   */
  processedOn?: number;

  /**
   * When this job was completed (unix milliseconds)
   */
  finishedOn?: number;

  /**
   * Which queue this job was part of
   */
  queue: Queue<T>;

  timestamp: number;

  /**
   * The named processor name
   */
  name: string;

  /**
   * The stacktrace for any errors
   */
  stacktrace: string[];

  returnvalue: any;

  private _progress: any;
  private delay: number;
  private failedReason: string;

  private v4Job: V4Job;

  constructor(queue: Queue, data: any, opts?: JobOptions);
  constructor(queue: Queue, name: string, data: any, opts?: JobOptions);

  constructor(queue: Queue, arg2: any, arg3?: any, arg4?: any) {

    Object.defineProperties(this, {
      v4Job: {
        enumerable: false,
        writable: true
      },
      id: {
        get: () => { return Utils.convertToJobId(this.v4Job.id); },
        set: (val) => { this.v4Job.id = Utils.convertToV4JobId(val); }
      },
      name: {
        get: () => { return this.v4Job.name; },
        set: (val) => { this.v4Job.name = val; }
      },
      data: {
        get: () => { return this.v4Job.data; },
        set: (val) => { this.v4Job.data = val; }
      },
      opts: {
        get: () => { return Utils.convertToJobOptions(this.v4Job.opts); },
        set: (val) => { this.v4Job.opts = Utils.convertToV4JobsOpts(val); }
      },
      _progress: {
        get: () => { return this.v4Job.progress; },
        set: (val) => { this.v4Job.progress = val; }
      },
      delay: {
        get: () => { return this.v4Job.opts && this.v4Job.opts.delay; },
        set: (val) => { this.v4Job.opts = { ...this.v4Job.opts, delay: val }; }
      },
      timestamp: {
        get: () => { return this.v4Job.timestamp; },
        set: (val) => { this.v4Job.timestamp = val; }
      },
      finishedOn: {
        get: () => { return (this.v4Job as any).finishedOn; },
        set: (val) => { (this.v4Job as any).finishedOn = val; }
      },
      processedOn: {
        get: () => { return (this.v4Job as any).processedOn; },
        set: (val) => { (this.v4Job as any).processedOn = val; }
      },
      failedReason: {
        get: () => { return (this.v4Job as any).failedReason; },
        set: (val) => { (this.v4Job as any).failedReason = val; }
      },
      attemptsMade: {
        get: () => { return (this.v4Job as any).attemptsMade; },
        set: (val) => { (this.v4Job as any).attemptsMade = val; }
      },
      stacktrace: {
        get: () => { return this.v4Job.stacktrace; },
        set: (val) => { this.v4Job.stacktrace = val; }
      },
      returnvalue: {
        get: () => { return this.v4Job.returnvalue; },
        set: (val) => { this.v4Job.returnvalue = val; }
      },
      toKey: {
        enumerable: false,
        get: () => { return (this.v4Job as any).toKey; }
      }
    });


    let name: string = Queue.DEFAULT_JOB_NAME;
    let data: any;
    let opts: JobOptions;

    if (typeof arg2 !== 'string') {
      // formally we cannot resolve args when data is string
      data = arg2;
      opts = arg3;
    } else {
      name = arg2;
      data = arg3;
      opts = arg4;
    }

    this.queue = queue;
    this.v4Job = new V4Job((queue as any).getV4Queue(), name, data, Utils.convertToV4JobsOpts(opts));
    this.stacktrace = [];
  }

  /**
   * Report progress on a job
   */
  progress(value: any): Promise<void> {
    return this.v4Job.updateProgress(value);
  }

  /**
   * Logs one row of log data.
   *
   * @param row String with log data to be logged.
   */
  log(row: string): Promise<any> {
    throw new Error('Not supported');
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is completed
   */
  isCompleted(): Promise<boolean> {
    return this.v4Job.isCompleted();
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is failed
   */
  isFailed(): Promise<boolean> {
    return this.v4Job.isFailed();
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is delayed
   */
  isDelayed(): Promise<boolean> {
    return this.v4Job.isDelayed();
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is active
   */
  isActive(): Promise<boolean> {
    return this.v4Job.isActive();
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is wait
   */
  isWaiting(): Promise<boolean> {
    return this.v4Job.isWaiting();
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is paused
   */
  isPaused(): Promise<boolean> {
    throw new Error('Not supported');
  }

  /**
   * Returns a promise resolving to a boolean which, if true, current job's state is stuck
   */
  isStuck(): Promise<boolean> {
    throw new Error('Not supported');
  }

  /**
   * Returns a promise resolving to the current job's status.
   * Please take note that the implementation of this method is not very efficient, nor is
   * it atomic. If your queue does have a very large quantity of jobs, you may want to
   * avoid using this method.
   */
  getState(): Promise<JobStatus> {
    throw new Error('Not supported');
  }

  /**
   * Update a specific job's data. Promise resolves when the job has been updated.
   */
  update(data: any): Promise<void> {
    return this.v4Job.update(data);
  }

  /**
   * Removes a job from the queue and from any lists it may be included in.
   * The returned promise resolves when the job has been removed.
   */
  remove(): Promise<void> {
    return this.v4Job.remove();
  }

  /**
   * Re-run a job that has failed. The returned promise resolves when the job
   * has been scheduled for retry.
   */
  retry(): Promise<void> {
    throw new Error('Not supported');
  }

  /**
   * Ensure this job is never ran again even if attemptsMade is less than job.attempts.
   */
  discard(): Promise<void> {
    throw new Error('Not supported');
  }

  /**
   * Returns a promise that resolves to the returned data when the job has been finished.
   * TODO: Add a watchdog to check if the job has finished periodically.
   * since pubsub does not give any guarantees.
   */
  finished(watchdog = 5000, ttl?: number): Promise<any> {
    return this.v4Job.waitUntilFinished((this.queue as any).getV4QueueEvents(), watchdog, ttl);
  }

  /**
   * Moves a job to the `completed` queue. Pulls a job from 'waiting' to 'active'
   * and returns a tuple containing the next jobs data and id. If no job is in the `waiting` queue, returns null.
   */
  async moveToCompleted(returnValue?: string, ignoreLock?: boolean): Promise<[SerializedJob, JobId] | null> {
    if(ignoreLock) {
      console.warn("ignoreLock is not supported");
    }
    const result = await this.v4Job.moveToCompleted(returnValue);
    if(result) {
      return [Utils.convertToSerializedJob(result[0]), Utils.convertToJobId(result[1])];
    }
  }

  /**
   * Moves a job to the `failed` queue. Pulls a job from 'waiting' to 'active'
   * and returns a tuple containing the next jobs data and id. If no job is in the `waiting` queue, returns null.
   */
  async moveToFailed(errorInfo: any, ignoreLock?: boolean): Promise<[any, JobId] | null> {
    if(ignoreLock) {
      console.warn("ignoreLock is not supported");
    }
    await this.v4Job.moveToFailed(errorInfo);
    return null;
  }

  /**
   * Promotes a job that is currently "delayed" to the "waiting" state and executed as soon as possible.
   */
  promote(): Promise<void> {
    throw new Error('Not supported');
  }

  /**
   * The lock id of the job
   */
  lockKey(): string {
    throw new Error('Not supported');
  }

  /**
   * Releases the lock on the job. Only locks owned by the queue instance can be released.
   */
  releaseLock(): Promise<void> {
    throw new Error('Not supported');
  }

  /**
   * Takes a lock for this job so that no other queue worker can process it at the same time.
   */
  takeLock(): Promise<number | false> {
    throw new Error('Not supported');
  }

  /**
   * Get job properties as Json Object
   */
  toJSON(): JobJson<T> {
    const result = {
      id: this.id,
      name: this.name,
      data: this.data,
      opts: { ...this.opts },
      progress: this._progress,
      delay: this.delay, // Move to opts
      timestamp: this.timestamp,
      attemptsMade: this.attemptsMade,
      failedReason: this.failedReason,
      stacktrace: this.stacktrace || null,
      returnvalue: this.returnvalue || null,
      finishedOn: this.finishedOn || null,
      processedOn: this.processedOn || null
    };
    if(! result.data) {
      (result as any).data = {};
    }
    return result;
  }


  private toData(): SerializedJob {
    const target: SerializedJob = {
      id: undefined,
      name: undefined,
      data: undefined,
      opts: undefined,
      progress: undefined,
      delay: undefined,
      timestamp: undefined,
      attemptsMade: undefined,
      failedReason: undefined,
      stacktrace: undefined,
      returnvalue: undefined,
      finishedOn: undefined,
      processedOn: undefined
    };
    const json = this.toJSON();
    target.id = undefined;
    target.name = undefined;
    target.data = JSON.stringify(json.data);
    target.opts = JSON.stringify(json.opts);
    target.progress = undefined;
    target.delay = undefined;
    target.timestamp = undefined;
    target.attemptsMade = undefined;
    target.failedReason = JSON.stringify(json.failedReason);
    target.stacktrace = JSON.stringify(json.stacktrace);
    target.returnvalue = JSON.stringify(json.returnvalue);
    target.finishedOn = undefined;
    target.processedOn = undefined;
    return target;
  };

  private static fromJSON<T>(queue: Queue, json: SerializedJob, jobId?: JobId) {
    const data = JSON.parse(json.data || '{}');
    const opts = JSON.parse(json.opts || '{}');

    const job = new Job(queue, json.name || Queue.DEFAULT_JOB_NAME, data, opts);

    job.id = json.id || jobId;
    job._progress = JSON.parse(json.progress || '0');
    job.delay = parseInt(json.delay);
    job.timestamp = parseInt(json.timestamp);
    if (json.finishedOn) {
      job.finishedOn = parseInt(json.finishedOn);
    }

    if (json.processedOn) {
      job.processedOn = parseInt(json.processedOn);
    }

    job.failedReason = json.failedReason;
    job.attemptsMade = parseInt(json.attemptsMade) || 0;

    job.stacktrace = [];
    try {
      const parsed = JSON.parse(json.stacktrace);
      if(Array.isArray(parsed)) {
        job.stacktrace = parsed;
      }
    } catch (e) {
    }

    if (typeof json.returnvalue === 'string') {
      try {
        job.returnvalue = JSON.parse(json.returnvalue);
      } catch (e) {
      }
    }

    return job;
  }

}

export interface RateLimiter {
  /** Max numbers of jobs processed */
  max: number;
  /** Per duration in milliseconds */
  duration: number;
  /** When jobs get rate limited, they stay in the waiting queue and are not moved to the delayed queue */
  bounceBack?: boolean;
}

export interface QueueOptions {
  /**
   * Options passed directly to the `ioredis` constructor
   */
  redis?: IORedis.RedisOptions;

  /**
   * When specified, the `Queue` will use this function to create new `ioredis` client connections.
   * This is useful if you want to re-use connections or connect to a Redis cluster.
   */
  createClient?(type: 'client' | 'subscriber' | 'bclient', redisOpts?: IORedis.RedisOptions): IORedis.Redis | IORedis.Cluster;

  /**
   * Prefix to use for all redis keys
   */
  prefix?: string;

  settings?: AdvancedSettings;

  limiter?: RateLimiter;

  defaultJobOptions?: JobOptions;
}

export interface AdvancedSettings {
  /**
   * Key expiration time for job locks
   */
  lockDuration?: number;

  /**
   * Interval in milliseconds on which to acquire the job lock.
   */
  lockRenewTime?: number;

  /**
   * How often check for stalled jobs (use 0 for never checking)
   */
  stalledInterval?: number;

  /**
   * Max amount of times a stalled job will be re-processed
   */
  maxStalledCount?: number;

  /**
   * Poll interval for delayed jobs and added jobs
   */
  guardInterval?: number;

  /**
   * Delay before processing next job in case of internal error
   */
  retryProcessDelay?: number;

  /**
   * Define a custom backoff strategy
   */
  backoffStrategies?: {
    [key: string]: (attemptsMade: number, err: Error) => number;
  };

  /**
   * A timeout for when the queue is in `drained` state (empty waiting for jobs).
   * It is used when calling `queue.getNextJob()`, which will pass it to `.brpoplpush` on the Redis client.
   */
  drainDelay?: number;
}

export type DoneCallback = (error?: Error | null, value?: any) => void;

export type JobId = number | string;

export type ProcessCallbackFunction<T> = (job: Job<T>, done: DoneCallback) => void;
export type ProcessPromiseFunction<T> = (job: Job<T>) => Promise<void>;

export type JobStatus = 'completed' | 'waiting' | 'active' | 'delayed' | 'failed';
export type JobStatusClean = 'completed' | 'wait' | 'active' | 'delayed' | 'failed';

export interface SerializedJob {
  id: JobId,
  name: string,
  data: string,
  opts: string,
  progress: any,
  delay: string,
  timestamp: string,
  attemptsMade: string,
  failedReason: any,
  stacktrace: string,
  returnvalue: any,
  finishedOn: string,
  processedOn: string
}

export interface JobJson<T> {
  id: JobId,
  name: string,
  data: T,
  opts: JobOptions,
  progress: any,
  delay?: number,
  timestamp: number,
  attemptsMade: number,
  failedReason: any,
  stacktrace: string[] | null,
  returnvalue: any,
  finishedOn: number,
  processedOn: number
}

export interface BackoffOptions {
  /**
   * Backoff type, which can be either `fixed` or `exponential`
   */
  type: string;

  /**
   * Backoff delay, in milliseconds
   */
  delay?: number;
}

export interface RepeatOptions {
  /**
   * Timezone
   */
  tz?: string;

  /**
   * End date when the repeat job should stop repeating
   */
  endDate?: Date | string | number;

  /**
   * Number of times the job should repeat at max.
   */
  limit?: number;
}

export interface CronRepeatOptions extends RepeatOptions {
  /**
   * Cron pattern specifying when the job should execute
   */
  cron: string;

  /**
   * Start date when the repeat job should start repeating (only with cron).
   */
  startDate?: Date | string | number;
}

export interface EveryRepeatOptions extends RepeatOptions {
  /**
   * Repeat every millis (cron setting cannot be used together with this setting.)
   */
  every: number;
}

export interface JobOptions {
  /**
   * Optional priority value. ranges from 1 (highest priority) to MAX_INT  (lowest priority).
   * Note that using priorities has a slight impact on performance, so do not use it if not required
   */
  priority?: number;

  /**
   * An amount of miliseconds to wait until this job can be processed.
   * Note that for accurate delays, both server and clients should have their clocks synchronized. [optional]
   */
  delay?: number;

  /**
   * The total number of attempts to try the job until it completes
   */
  attempts?: number;

  /**
   * Repeat job according to a cron specification
   */
  repeat?: CronRepeatOptions | EveryRepeatOptions;

  /**
   * Backoff setting for automatic retries if the job fails
   */
  backoff?: number | BackoffOptions;

  /**
   * A boolean which, if true, adds the job to the right
   * of the queue instead of the left (default false)
   */
  lifo?: boolean;

  /**
   *  The number of milliseconds after which the job should be fail with a timeout error
   */
  timeout?: number;

  /**
   * Override the job ID - by default, the job ID is a unique
   * integer, but you can use this setting to override it.
   * If you use this option, it is up to you to ensure the
   * jobId is unique. If you attempt to add a job with an id that
   * already exists, it will not be added.
   */
  jobId?: JobId;

  /**
   * A boolean which, if true, removes the job when it successfully completes.
   * When a number, it specifies the amount of jobs to keep.
   * Default behavior is to keep the job in the failed set.
   */
  removeOnComplete?: boolean | number;

  /**
   * A boolean which, if true, removes the job when it fails after all attempts.
   * When a number, it specifies the amount of jobs to keep.
   * Default behavior is to keep the job in the completed set.
   */
  removeOnFail?: boolean | number;

  /**
   * Limits the amount of stack trace lines that will be recorded in the stacktrace.
   */
  stackTraceLimit?: number;
}

export interface JobCounts {
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
}

export interface JobInformation {
  key: string;
  name: string;
  id?: string;
  endDate?: number;
  tz?: string;
  cron: string;
  next: number;
}

export type EventCallback = () => void;

export type ErrorEventCallback = (error: Error) => void;

export interface JobPromise {
  /**
   * Abort this job
   */
  cancel(): void;
}

export type ActiveEventCallback<T = any> = (job: Job<T>, jobPromise?: JobPromise) => void;

export type StalledEventCallback<T = any> = (job: Job<T>) => void;

export type ProgressEventCallback<T = any> = (job: Job<T>, progress: any) => void;

export type CompletedEventCallback<T = any> = (job: Job<T>, result: any) => void;

export type FailedEventCallback<T = any> = (job: Job<T>, error: Error) => void;

export type CleanedEventCallback<T = any> = (jobs: Array<Job<T>>, status: JobStatusClean) => void;

export type RemovedEventCallback<T = any> = (job: Job<T>) => void;

export type WaitingEventCallback = (jobId: JobId) => void;

class Utils {

  static redisOptsFromUrl(urlString: string) {
    const redisOpts: IORedis.RedisOptions = {};
    try {
      const redisUrl = url.parse(urlString);
      redisOpts.port = parseInt(redisUrl.port, 10) || 6379;
      redisOpts.host = redisUrl.hostname;
      redisOpts.db = parseInt(redisUrl.pathname, 10) ?
        parseInt(redisUrl.pathname.split('/')[1], 10) : 0;
      if (redisUrl.auth) {
        redisOpts.password = redisUrl.auth.split(':')[1];
      }
    } catch (e) {
      throw new Error(e.message);
    }
    return redisOpts;
  };

  static convertToV4JobId(id: JobId): string {
    if(id !== undefined) {
      if(typeof id === "string") {
        return id;
      } else {
        return id.toString();
      }
    }
  }

  static convertToJobId(id: string): JobId {
    if(id !== undefined) {
      if((/^\d+$/g).test(id)) {
        return parseInt(id);
      }
      return id;
    }
  }

  static convertToJob(source: V4Job, queue: Queue<any>): Job {
    if(source) {
      return new Job(queue, source.name, source.data, Utils.convertToJobOptions(source.opts));
    }
  };

  static convertToJobOptions(source: V4JobsOpts): JobOptions {
    if(! source) {
      return;
    }

    const target: JobOptions = {};

    (target as any).timestamp = source.timestamp;
    target.priority = source.priority;
    target.delay = source.delay;
    target.attempts = source.attempts;
    target.repeat = Utils.convertToRepeatOptions(source.repeat);

    if(source.backoff !== undefined) {
      if(typeof source.backoff === "number") {
        target.backoff = source.backoff;
      } else {
        target.backoff = Utils.convertToBackoffOptions(source.backoff);
      }
    }

    target.lifo = source.lifo;
    target.timeout = source.timeout;
    target.jobId = source.jobId;
    target.removeOnComplete = source.removeOnComplete;
    target.removeOnFail = source.removeOnFail;
    target.stackTraceLimit = source.stackTraceLimit;
    return target;
  }

  static convertToV4QueueBaseOptions(source: QueueOptions): V4QueueBaseOptions {
    if(! source) {
      return;
    }

    const target: V4QueueBaseOptions = {};

    if (source.redis) {
      const client = new IORedis(source.redis);
      target.connection = client;
      target.client = client;
    }

    target.prefix = source.prefix;

    return target;
  }

  static convertToV4QueueOptions(source: QueueOptions): V4QueueOptions {
    if(! source) {
      return;
    }

    const target: V4QueueOptions = Utils.convertToV4QueueBaseOptions(source);

    target.defaultJobOptions = Utils.convertToV4JobsOpts(source.defaultJobOptions);
    target.createClient = Utils.adaptToV4CreateClient(source.createClient, source.redis);

    return target;
  }

  static convertToV4QueueEventsOptions(source: QueueOptions) {
    if(! source) {
      return;
    }

    const target: V4QueueEventsOptions = Utils.convertToV4QueueBaseOptions(source);

    target.lastEventId = undefined;
    target.blockingTimeout = undefined;

    return target;
  }

  static convertToV4JobsOpts(source: JobOptions): V4JobsOpts {
    if(! source) {
      return;
    }

    const target: V4JobsOpts = {};

    target.timestamp = (source as any).timestamp;
    target.priority = source.priority;
    target.delay = source.delay;
    target.attempts = source.attempts;
    target.repeat = Utils.convertToV4RepeatOpts(source.repeat);

    if(source.backoff !== undefined) {
      if(typeof source.backoff === "number") {
        target.backoff = source.backoff;
      } else {
        target.backoff = Utils.convertToV4BackoffOpts(source.backoff);
      }
    }

    target.lifo = source.lifo;
    target.timeout = source.timeout;

    if(source.jobId !== undefined) {
      target.jobId = Utils.convertToV4JobId(source.jobId);
    }

    if(source.removeOnComplete !== undefined) {
      if(typeof source.removeOnComplete === "number") {
        console.warn("numeric removeOnComplete option is not supported");
      } else {
        target.removeOnComplete = source.removeOnComplete;
      }
    }

    if(source.removeOnFail !== undefined) {
      if(typeof source.removeOnFail === "number") {
        console.warn("numeric removeOnFail option is not supported");
      } else {
        target.removeOnFail = source.removeOnFail;
      }
    }
    target.stackTraceLimit = source.stackTraceLimit;
    return target;
  }

  static convertToV4RepeatOpts(source: CronRepeatOptions | EveryRepeatOptions): V4RepeatOpts {
    if(! source) {
      return;
    }

    const target: V4RepeatOpts = {};

    target.cron = (source as CronRepeatOptions).cron;
    target.tz = (source as CronRepeatOptions).tz;
    target.startDate = (source as CronRepeatOptions).startDate;
    target.endDate = (source as CronRepeatOptions).endDate;
    target.limit = (source as EveryRepeatOptions).limit;
    target.every = (source as EveryRepeatOptions).every;
    target.count = undefined;
    target.prevMillis = undefined;

    return target;
  }

  static convertToRepeatOptions(source: V4RepeatOpts): CronRepeatOptions | EveryRepeatOptions {
    if(! source) {
      return;
    }

    if(source.cron) {
      const target: CronRepeatOptions = { cron: undefined };
      target.cron = (source as CronRepeatOptions).cron;
      target.tz = (source as CronRepeatOptions).tz;
      target.startDate = (source as CronRepeatOptions).startDate;
      target.endDate = (source as CronRepeatOptions).endDate;
      target.limit = (source as EveryRepeatOptions).limit;
      return target;
    } else {
      const target: EveryRepeatOptions = { every: undefined };
      target.tz = (source as CronRepeatOptions).tz;
      target.endDate = (source as CronRepeatOptions).endDate;
      target.limit = (source as EveryRepeatOptions).limit;
      target.every = (source as EveryRepeatOptions).every;
      return target;
    }
  }

  static convertToV4BackoffOpts(source: BackoffOptions): V4BackoffOpts {
    if(! source) {
      return;
    }

    const target: V4BackoffOpts = { type: undefined, delay: undefined };

    target.type = source.type;
    target.delay = source.delay;

    return target;
  }

  static convertToBackoffOptions(source: V4BackoffOpts): BackoffOptions {
    if(! source) {
      return;
    }

    const target: BackoffOptions = { type: undefined };

    target.type = source.type;
    target.delay = source.delay;

    return target;
  }

  static convertToV4WorkerOptions(source: QueueOptions): V4WorkerOptions {
    if(! source) {
      return;
    }
    const target: V4WorkerOptions = Utils.convertToV4QueueBaseOptions(source);

    target.concurrency = undefined;
    target.limiter = Utils.convertToV4RateLimiterOpts(source.limiter);
    target.skipDelayCheck = undefined;
    target.drainDelay = undefined;
    target.visibilityWindow = undefined;
    target.settings = Utils.convertToV4AdvancedOpts(source.settings);

    return target;
  }

  static convertToV4RateLimiterOpts(source: RateLimiter): V4RateLimiterOpts {
    if(! source) {
      return;
    }

    const target: V4RateLimiterOpts = { max: undefined, duration: undefined };

    target.max = source.max;
    target.duration = source.duration;

    if(source.bounceBack !== undefined) {
      console.warn("bounceBack option is not supported");
    }

    return target;
  }

  static convertToV4AdvancedOpts(source: AdvancedSettings): V4AdvancedOpts {
    if(! source) {
      return;
    }

    const target: V4AdvancedOpts = {};

    target.lockDuration = source.lockDuration;
    target.stalledInterval = source.stalledInterval;
    target.maxStalledCount = source.maxStalledCount;
    target.guardInterval = source.guardInterval;
    target.retryProcessDelay = source.retryProcessDelay;
    target.backoffStrategies = source.backoffStrategies;
    target.drainDelay = source.drainDelay;

    if(source.lockRenewTime !== undefined) {
      console.warn("lockRenewTime option is not supported");
    }

    return target;
  }

  static convertToJobCounts(source: { [key:string]: number }): JobCounts {
    if(source) {
      const target: JobCounts = { active: undefined,
        completed: undefined, failed: undefined, delayed: undefined, waiting: undefined };
      Object.keys(source).forEach((key) => {
        if(typeof source[key] === "number") {
          switch(key) {
            case 'active':
              target.active = source[key]; break;
            case 'completed':
              target.completed = source[key]; break;
            case  'failed':
              target.failed = source[key]; break;
            case  'delayed':
              target.delayed = source[key]; break;
            case  'waiting':
              target.waiting = source[key]; break;
          }
        }
      });
      return target;
    }
  }

  static convertToSerializedJob(source: V4JobJson): SerializedJob {
    if(source) {
      const target: SerializedJob = {
        id: undefined,
        name: undefined,
        data: undefined,
        opts: undefined,
        progress: undefined,
        delay: undefined,
        timestamp: undefined,
        attemptsMade: undefined,
        failedReason: undefined,
        stacktrace: undefined,
        returnvalue: undefined,
        finishedOn: undefined,
        processedOn: undefined
      };
      target.id = source.id;
      target.name = source.name;
      target.data = source.data;
      target.opts = source.opts;
      target.progress = source.progress;
      if(source.opts) {
        try {
          target.delay = JSON.parse(source.opts).delay;
        } catch(e) {
        }
      }
      if(source.timestamp !== undefined) {
        target.timestamp = source.timestamp.toString();
      }
      if(source.attemptsMade !== undefined) {
        target.attemptsMade = source.attemptsMade.toString();
      }
      target.failedReason = source.failedReason;
      target.stacktrace = source.stacktrace;
      target.returnvalue = source.returnvalue;
      if(source.finishedOn !== undefined) {
        target.finishedOn = source.finishedOn.toString();
      }
      if(source.processedOn !== undefined) {
        target.processedOn = source.processedOn.toString();
      }
      return target;
    }
  }

  static adaptToV4CreateClient(
    createClient: (type: 'client' | 'subscriber' | 'bclient', redisOpts?: IORedis.RedisOptions) => IORedis.Redis | IORedis.Cluster,
    redis: IORedis.RedisOptions): (type: V4ClientType) => IORedis.Redis {
    if(! createClient) {
      return;
    }

    return ((type) => {
      switch(type) {
        case V4ClientType.blocking:
          return createClient('bclient', redis) as IORedis.Redis;
        case V4ClientType.normal:
          return createClient('client', redis) as IORedis.Redis;
        default:
          return undefined;
      }
    });
  }

}