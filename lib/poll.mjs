// One request at a time, schedule AFTER completion, cancel on hide/unmount.
export function poll({ read, receive, fail, interval, initial, visibility = globalThis.document, timers = globalThis, timeout = 12000 }) {
  let stopped=false, timer, controller, value=initial, failures=0
  const visible=()=>visibility.visibilityState==='visible'
  const schedule=()=>{
    timers.clearTimeout(timer)
    if(!stopped && visible()) timer=timers.setTimeout(run,Math.min(60000,interval(value)*2**failures))
  }
  async function run() {
    if(stopped || !visible() || controller) return
    const current=controller=new AbortController()
    const deadline=timers.setTimeout(()=>current.abort(),timeout)
    try {
      const next=await read(current.signal)
      if(!stopped && !current.signal.aborted){value=next;failures=0;receive(next)}
    } catch(e) {
      if(!stopped && visible()){failures=Math.min(3,failures+1);fail(e)}
    } finally {timers.clearTimeout(deadline);controller=null;schedule()}
  }
  const change=()=>{timers.clearTimeout(timer);if(visible())run();else controller?.abort()}
  visibility.addEventListener('visibilitychange',change)
  schedule()
  return ()=>{stopped=true;timers.clearTimeout(timer);controller?.abort();visibility.removeEventListener('visibilitychange',change)}
}
