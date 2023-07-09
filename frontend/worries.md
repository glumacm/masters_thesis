### Question from sync-entity worker
Problem o katerem je potrebno zares razmisliti:
- Kako bom resil problem socasnosti. v primeru da nekdo dostopi v isti [ms] do istega podatka v bazi, kot ga mi tukaj popravljamo/nastavljamo?

### Retry process
- Retry can repeat up to 10 times. What if sync interval/retry never succeeds?

### Retry process -> TIMEOUT scenario
- What if we send request and request was retrieved, but before returning the response, connection with server broke (but BE still managed to store data)