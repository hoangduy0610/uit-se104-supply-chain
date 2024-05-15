$(document).ready(function () {
  const userInfo = JSON.parse(localStorage.getItem('@auth/userInfo'));
  const tableRenderColumns = [
    "batchId",
    "name",
    {
      "data": 'status',
      render: function (data, type, row, meta) {
        let statusText = 'Đang nuôi trồng tại trang trại';
        if (row.status == 'InTransportation') {
          if (row.transporter) {
            statusText = 'Đang trên đường vận chuyển'
          } else {
            statusText = 'Đang chờ nhà vận chuyển nhận lô hàng'
          }
        } else if (row.status == 'InStore') {
          if (row.retailer) {
            statusText = 'Đã nhập vào kho bán lẻ'
          } else {
            statusText = 'Đã vận chuyển đến. Đang chờ nhập kho'
          }
        }
        return `
          <strong>${statusText}</strong> 
        `;
      }
    },
    "quantity",
    {
      "data": 'incharge',
      render: function (data, type, row, meta) {
        const isDisabled =
          !userInfo.roles.includes(data) &&
          !userInfo.roles.includes('ROLE_ADMIN') ||
          (row.status == 'InStore' && row.retailer)

        const dsb = !isDisabled ? '' : 'disabled';
        return `
            <div class="d-flex p-2 justify-content-center">
              <button type="button" class="btn btn-danger btn-delete-batch m-1" aria-disabled="true">Delete</button>
              <button type="button" class="btn btn-primary btn-update-batch m-1">Update</button>
              <button type="button" class="btn btn-success btn-change-batch m-1" aria-disabled="true">Biến Động</button>
              <button type="button" class="btn btn-info btn-forward-batch m-1 ${dsb}" ${dsb} aria-disabled="true">Chuyển tiếp</button>
            </div>
          `;
      }
    },
  ]
  const BatchTable = initDataTable('#BatchTable', { ajaxUrl: API_ENDPOINT.BATCH.LIST_BATCH }, tableRenderColumns);
  // delete batch
  $('#BatchTable tbody').on('click', '.btn-delete-batch', function () {
    const row = $(this).parents('tr')[0];
    const data = BatchTable.row(row).data();
    var id = data._id;
    console.log(id);

    $.ajax({
      url: fillEndpointPlaceholder(API_ENDPOINT.BATCH.DELETE_BATCH, { id: id }),
      type: 'DELETE',
      beforeSend: function (request) {
        request.setRequestHeader("Authorization", ACCESS_TOKEN);
      },
      success: function (result) {
        alert('xóa batch thành công');
        BatchTable.ajax.reload();
      },
      error: function (error) {
        alert('Xóa batch thất bại');
      }
    });
  });
  // update batch
  $('#BatchTable tbody').on('click', '.btn-update-batch', function () {
    const row = $(this).parents('tr')[0];
    const data = BatchTable.row(row).data();
    const id = data._id;
    // console.log(id);
    window.location.href = `form-batch.html?id=${id}`
  });

  $('#BatchTable tbody').on('click', '.btn-change-batch', function () {
    const row = $(this).parents('tr')[0];
    const data = BatchTable.row(row).data();
    // console.log(data)
    localStorage.setItem('@batchs/fluctuation/batch', JSON.stringify(data));


    $('#Batch-change-Modal').modal('show');
  });

  $('#BatchTable tbody').on('click', '.btn-forward-batch', function () {
    const row = $(this).parents('tr')[0];
    const data = BatchTable.row(row).data();
    $.ajax({
      url: fillEndpointPlaceholder(API_ENDPOINT.BATCH.FORWARD_BATCH, { id: data.batchId }),
      type: 'PUT',
      beforeSend: function (request) {
        request.setRequestHeader("Authorization", ACCESS_TOKEN);
      },
      success: function (result) {
        alert('Chuyển tiếp thành công');
        BatchTable.ajax.reload();
      },
      error: function (error) {
        alert('Chuyển tiếp thất bại');
      }
    });
  });


  $("#submit-fluctuation").click(function () {
    const batch = JSON.parse(localStorage.getItem('@batchs/fluctuation/batch'));
    const user = JSON.parse(localStorage.getItem('@auth/userInfo'));
    const type = $('#fluctuation').val();
    const reason = $('#fluc-reason').val();
    const amount = $('#fluc-amount').val();
    const commonField = {
      name: batch.name,
      quantity: parseInt(batch.quantity) + parseInt(amount) * (type === 'INC' ? 1 : -1),
      status: batch.status
    };

    $.ajax({
      url: fillEndpointPlaceholder(API_ENDPOINT.BATCH.UPDATE_BATCH, { id: batch._id }),
      method: 'PUT',
      headers: {
        'Authorization': ACCESS_TOKEN,
      },
      data: commonField,
      success: function () {
        const actionText = type === 'INC' ? `Nông dân ${user.name} tăng số lượng thêm ${amount} với lí do: ${reason}` : `Nông dân ${user.name} giảm số lượng đi ${amount} với lí do: ${reason}`
        $.ajax({
          url: API_ENDPOINT.HISTORY.CREATE_HISTORY,
          method: 'POST',
          headers: {
            'Authorization': ACCESS_TOKEN,
          },
          data: {
            batchId: batch.batchId,
            action: actionText,
          },
          success: function () {
            alert("Fluctuation thành công")

            $('#Batch-change-Modal').modal('hide');
            BatchTable.ajax.reload();
          },
          error: function () {
            alert("Fluctuation that bai")

            $('#Batch-change-Modal').modal('hide');
            BatchTable.ajax.reload();
          }
        });
      },
      error: function () {
        alert("Fluctuation that bai")
        $('#Batch-change-Modal').modal('hide');
        BatchTable.ajax.reload();
      }
    })
  });
});