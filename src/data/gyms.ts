import type { BuiltinGym } from '../domain/gyms'

/**
 * The built-in gym list: gym NAMES ONLY (PRD D11). No pass options, prices or validity periods —
 * people enter their own on each row. This is the product owner's checked list of Singapore gyms
 * (PRD section 11, plan step 3.1). Names are written exactly as the owner gave them, including
 * "boulder+" and "fit·bloc"; typing them with or without spaces, punctuation or capitals finds the
 * same gym (`normalizeGymName`).
 *
 * Ids are fixed forever: a pass keeps pointing at its gym by id, and a backup file refers to a
 * gym by id. NEVER change or reuse an id. To rename a gym, change only its `name`; to add one, add
 * a row with a new id; do not remove a gym that people may have used. Gyms are tracked per brand;
 * an outlet with different pricing is typed as its own gym name (D10).
 */
export const BUILTIN_GYMS: BuiltinGym[] = [
  { id: 'f60217fb-1274-4506-88a9-1bc30925a810', name: 'BFF Climb (All Outlets)' },
  { id: 'bccb631d-bacb-476c-a3d8-327d1d21986b', name: 'BFF Climb (Tampines)' },
  { id: '200e6180-765c-40d3-99f6-fcafa4e32983', name: 'Boulder Movement' },
  { id: '6a826e16-354f-4f90-a958-a6cd0f57ef0d', name: 'Boulder Planet' },
  { id: 'a52e157a-02c3-4fdb-8f36-daaed051ee7d', name: 'boulder+' },
  { id: '641070a8-b482-44d3-803e-9ef455bbc72f', name: 'Climb Central' },
  { id: 'd9fcadad-6459-4df9-9c7c-c89587bf1f33', name: 'fit·bloc' },
  { id: 'c8e707a7-9d51-4383-8cbe-08bcca719e29', name: 'Ark Bloc' },
  { id: '0b9e434b-128b-47ee-bb14-562e1560097b', name: 'Climb@T3' },
  { id: '81210d7e-93f0-455b-9a64-949bd78043aa', name: 'Climba' },
  { id: 'a916595c-2ab1-412c-b201-35d80a61fcaf', name: 'ClimbUp' },
  { id: '2e7e2e3c-13b0-4434-bcae-568287efd7b1', name: 'Ground Up Climbing' },
  { id: 'b7f0e0d3-aa52-4cbd-bfef-7382d9751388', name: 'Kinetics Climbing' },
  { id: '2d58b00a-af34-4f68-b6b4-220f40a7d8b0', name: 'Lighthouse Climbing' },
  { id: '569a0437-0412-4143-8573-2cc9a4832692', name: 'My Little Climbing Room' },
  { id: '4a84f7cf-d720-4bb3-ae63-1f710e264e8a', name: 'Outpost Climbing' },
  { id: '1eec0251-65d6-4256-b027-8b9dbe462738', name: 'OYEYO Boulder Home' },
  { id: 'c450b09c-59ab-4be3-9cc0-28562f5abff0', name: 'Upwall Climbing' },
  { id: '9134011d-7de7-410d-9ded-72a3c5eb1d81', name: 'Verticlimb' },
  { id: '80e340a8-95b3-4934-bf4d-2036eff89276', name: 'Z-Vertigo Boulder Gym' },
]
