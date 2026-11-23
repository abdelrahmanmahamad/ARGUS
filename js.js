import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://cjivfdlrrwuwegybtpty.supabase.co';
const supabaseKey = 'sb_publishable_mcec1_u6zMIRD2kFMWOulA_d_8thPqr';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase connected!");
console.log("supabase client is ready");
async function testConnection() {
const { data, error } = await supabase
.from('expenses')
.select('*')
.limit(1);

if (error) {
    console.error("Connection test failed:", error.message);
} else {
    console.log("Supabase database connected successfully!", data);
}
}

testConnection();