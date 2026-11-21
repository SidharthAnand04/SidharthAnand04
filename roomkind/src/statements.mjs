export const statements = {
 addTip:'INSERT OR IGNORE INTO tips(id,room,cents,mode,created,status) VALUES(?,?,?,?,?,?)',
 tip:'SELECT * FROM tips WHERE id=?',
 attachIntent:'UPDATE tips SET intent=? WHERE id=? AND intent IS NULL',
 setStatus:'UPDATE tips SET status=? WHERE id=?',
 openRows:'SELECT room,mode,status,count(*) tips,sum(cents) cents FROM tips WHERE created>=? GROUP BY room,mode,status ORDER BY room',
 reports:'SELECT * FROM reports ORDER BY period_start DESC',
 reconcile:'SELECT * FROM tips WHERE mode=? AND intent IS NOT NULL AND created>=? AND created<? AND id>? ORDER BY id LIMIT 50',
 closePeriod:`INSERT INTO reports(period_start,period_end_exclusive,generated_at,summary_json)
    SELECT ?,?,?,COALESCE(json_group_array(json_object('room',room,'mode',mode,'status',status,'tips',n,'cents',total)),'[]')
    FROM (SELECT room,mode,status,count(*) n,sum(cents) total FROM tips
          WHERE created>=? AND created<? GROUP BY room,mode,status ORDER BY room,mode,status)
    WHERE true ON CONFLICT(period_start) DO UPDATE SET generated_at=excluded.generated_at,summary_json=excluded.summary_json
    WHERE reports.summary_json<>excluded.summary_json`
};
