import OdPass from '../model/odPass.model.js';
import { Company, Department } from '../utils/join.js';
import { Op } from 'sequelize';
import { Employee } from '../utils/join.js';

const createOdPass = async(req, res) =>{
    const {
        emp_id,
        comp_fname,    
        fromdate,
        todate,
        add_date,
        oddays,
        odtype,
        remark,
        created_by,
        created_at
    } = req.body

    try {

        if(!emp_id || !comp_fname || !fromdate || !todate || !add_date || !oddays || !odtype || !remark ){
            return res.status(400).json({message:"All fields are required"})
        } 

        const company = await Company.findOne({ where: { comp_fname } });
        if (!company) {
            return res.status(404).json({ message: "Company not found" });
        }

        console.log("comp_ID",company.comp_id);

        if(fromdate > todate){
            return res.status(400).json({message:"From date should be less than to date"})
        }

        const existingOd = await OdPass.findOne({
            where: {
                emp_id,
                [Op.or]: [
                    {
                        fromdate: {
                            [Op.between]: [fromdate, todate]
                        }
                    },
                    {
                        todate: {
                            [Op.between]: [fromdate, todate]
                        }
                    },
                    {
                    [Op.and]: [
                        {
                            fromdate: {
                                [Op.lte]: fromdate
                            }
                        },
                        {
                            todate: {
                                [Op.gte]: todate
                            }
                        }
                    ]
                }
              ]
            }
        })

        if (existingOd) {
            return res.status(409).json({ message: "OD Pass already requested for overlapping dates" });
        }

        const odPass = await OdPass.create({
            emp_id,
            comp_id: company.comp_id,
            add_date,
            fromdate,
            todate,
            oddays,
            odtype,
            remark,
            status: '1',
            app_type: 'OD',
            created_by,
            approved: 'PENDING',
            approve_step1: '0',
            created_at,

        })

        console.log("odPass",odPass);

        res.status(201).json({message:"OD Pass created successfully", odPass})
        
    } catch (error) {
        console.log("Getting error from od pass",error);
        res.status(500).json({message:"server side error"})
    }
}

const getHistoryOfOdPass = async(req, res) =>{
    const {emp_id, approved} = req.query;
    try {

        const odPassRecords = await OdPass.findAll({ where: { emp_id, approved },
        include: [
            {
                model: Employee,
                as: 'employee',
                attributes: ['em_id','dep_id','em_username'],
                include: [
                    {
                        model: Department,
                        as: 'department',
                        attributes: ['id', 'dep_name']
                    }
                ]
            }
        ]
        });

        const odPass = odPassRecords.map((od) => ({
                        id: od.id,
            emp_id: od.emp_id,
            comp_id: od.comp_id,
            add_date: od.add_date,
            fromdate: od.fromdate,
            todate: od.todate,
            oddays: od.oddays,
            odtype: od.odtype,
            remark: od.remark,
            created_at: od.created_at,
            approved: od.approved,
            app_type: od.app_type,
            status: od.status,
            updated_by: od.updated_by,
            updated_at: od.updated_at,
            created_by: od.created_by,
            approve_step1: od.approve_step1,
            employee_name: od.employee?.em_username || null,
            department_name: od.employee?.department?.dep_name || null
        }));

        if (!odPass || odPass.length === 0) {
            return res.status(404).json({ message: "No OD Pass history found for the employee" });
        }

        res.status(200).json({message:"History of od pass fetched successfully", odPass})
        
    } catch (error) {
        console.log("error from get history of od pass",error);
        return res.status(500).json({message:"server side error"})
    }
}

const updateOdPassApplication = async(req, res) => {
    const {id} = req.params;
    const updateData = req.body;

    try {
        const OdHistory = await OdPass.findByPk(id);
        if (!OdHistory) {
            return res.status(404).json({ message: "Od Pass not found" });
        }
        
        console.log("Od-Pass",updateData);

        let updatedOdDuration = updateData.oddays || OdHistory.oddays;

        updatedOdDuration = parseFloat(updatedOdDuration);

        if (!(updatedOdDuration === 0.5 || updatedOdDuration >= 1))
            {
                console.log("Invalid input:", updatedOdDuration);
            return res.status(400).json({
                message: "Leave duration must be at least 1 day or exactly 0.5 for half-day leave.",
            });
        }

        updateData.add_date = new Date();
        console.log("updated date",updateData.add_date);

        updateData.updated_at = new Date();
        console.log("updated date",updateData.updated_at);

        updateData.updated_by = OdHistory.emp_id;
        console.log("updated id",updateData.updated_by);

        const updateResult = await OdHistory.update(updateData);
        console.log("Od-Pass application updated successfully",updateResult);

        res.status(201).json({ message: 'OD-Pass application updated successfully', data: updateResult });

        
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error while upadating OD-Pass application" });
    }
}

export {
    createOdPass,
    getHistoryOfOdPass,
    updateOdPassApplication
}