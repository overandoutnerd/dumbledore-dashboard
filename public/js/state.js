const HOUSE_META = {
    gryffindor: { name:'Gryffindor', icon:'lion', color:'#c14545', bg:'rgba(193,69,69,.15)' },
    ravenclaw:  { name:'Ravenclaw',  icon:'eagle', color:'#5a7fc2', bg:'rgba(90,127,194,.15)' },
    hufflepuff: { name:'Hufflepuff', icon:'badger', color:'#e5a324', bg:'rgba(229,163,36,.15)' },
    slytherin:  { name:'Slytherin',  icon:'snake', color:'#1f7a5c', bg:'rgba(31,122,92,.15)' },
};

const PERM_META = {
    everyone: { label:'Everyone', cls:'perm-everyone', icon:'globe' },
    botmanager: { label:'Bot Manager', cls:'perm-manager', icon:'wand' },
    manageserver: { label:'Manage Server', cls:'perm-server', icon:'landmark' },
    manageroles: { label:'Manage Roles', cls:'perm-roles', icon:'shield' },
};

let CURRENT_USER = null;
let COMMANDS = [];
let CHANNELS = [];
let INTERVIEW_CATEGORIES = [];
let ROLES = [];
let CMD_USAGE = {};
let selectedSentenceMember = null;

